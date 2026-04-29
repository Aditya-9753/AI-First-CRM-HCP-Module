from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uvicorn
import json

from database import get_db, init_db
from models import Interaction, HCP, FollowUp
from schemas import InteractionCreate, InteractionEdit, ChatRequest
from agent import process_chat
from suggestions import generate_llm_suggestions

app = FastAPI(title="HCP CRM API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

# ──────────────────────────────────────────────────────────────
# LLM-POWERED FOLLOW-UP SUGGESTIONS
# ──────────────────────────────────────────────────────────────
class SuggestRequest(BaseModel):
    hcp_name: str
    notes: str
    sentiment: str = "Neutral"

@app.post("/suggest-followup")
def suggest_followup(req: SuggestRequest, db: Session = Depends(get_db)):
    try:
        suggestions = generate_llm_suggestions(
            db=db,
            hcp_name=req.hcp_name,
            notes=req.notes,
            sentiment=req.sentiment
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────
# AI CHAT — returns extracted_fields so frontend can auto-fill
# ──────────────────────────────────────────────────────────────
@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    try:
        result = process_chat(req.session_id, req.message)

        # Parse extracted_fields from tool results (if LogInteractionTool was called)
        extracted_fields = result.get("extracted_fields", {})

        return {
            "response": result["response"],
            "tools_called": result["tools_called"],
            "extracted_fields": extracted_fields,
            "data": {}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────
# INTERACTIONS CRUD
# ──────────────────────────────────────────────────────────────
@app.post("/log-interaction")
def log_interaction(interaction: InteractionCreate, db: Session = Depends(get_db)):
    try:
        # Validate required fields
        if not interaction.hcp_name.strip():
            raise HTTPException(status_code=400, detail="HCP Name is required")

        hcp = db.query(HCP).filter(HCP.name.ilike(interaction.hcp_name.strip())).first()
        if not hcp:
            hcp = HCP(name=interaction.hcp_name.strip())
            db.add(hcp)
            db.commit()
            db.refresh(hcp)

        new_interaction = Interaction(
            hcp_id=hcp.id,
            interaction_type=interaction.interaction_type,
            date=interaction.date,
            time=interaction.time,
            notes=interaction.notes,
            topics_discussed=interaction.topics_discussed,
            materials_shared=interaction.materials_shared,
            samples_distributed=interaction.samples_distributed,
            sentiment=interaction.sentiment,
            outcomes=interaction.outcomes
        )
        db.add(new_interaction)
        db.commit()
        db.refresh(new_interaction)

        if interaction.follow_up_actions:
            for action in interaction.follow_up_actions.split(','):
                if action.strip():
                    fu = FollowUp(interaction_id=new_interaction.id, action_item=action.strip())
                    db.add(fu)
            db.commit()

        return {"success": True, "id": new_interaction.id, "hcp_name": hcp.name}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/edit-interaction/{interaction_id}")
def edit_interaction(interaction_id: int, edit_data: InteractionEdit, db: Session = Depends(get_db)):
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            raise HTTPException(status_code=404, detail="Interaction not found")
        if not hasattr(interaction, edit_data.field):
            raise HTTPException(status_code=400, detail="Invalid field")
        setattr(interaction, edit_data.field, edit_data.value)
        db.commit()
        db.refresh(interaction)
        return {"success": True, "field": edit_data.field, "value": edit_data.value}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete-interaction/{interaction_id}")
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)):
    try:
        db.query(FollowUp).filter(FollowUp.interaction_id == interaction_id).delete()
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            raise HTTPException(status_code=404, detail="Interaction not found")
        db.delete(interaction)
        db.commit()
        return {"success": True, "message": f"Interaction {interaction_id} deleted."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────
# GET INTERACTIONS (with search)
# ──────────────────────────────────────────────────────────────
@app.get("/api/interactions")
def get_all_interactions(
    search: str = Query("", description="Search by HCP name or notes"),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Interaction).order_by(desc(Interaction.created_at))
        result = []
        for i in query.all():
            hcp = db.query(HCP).filter(HCP.id == i.hcp_id).first()
            hcp_name = hcp.name if hcp else "Unknown"
            # Apply search filter
            if search:
                s = search.lower()
                if s not in hcp_name.lower() and s not in (i.notes or "").lower() and s not in (i.topics_discussed or "").lower():
                    continue
            result.append({
                "id": i.id,
                "hcp_name": hcp_name,
                "interaction_type": i.interaction_type,
                "date": i.date,
                "time": i.time,
                "notes": i.notes,
                "topics_discussed": i.topics_discussed,
                "materials_shared": i.materials_shared,
                "samples_distributed": i.samples_distributed,
                "sentiment": i.sentiment,
                "outcomes": i.outcomes,
                "created_at": str(i.created_at)
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────
# DASHBOARD SUMMARY
# ──────────────────────────────────────────────────────────────
@app.get("/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    try:
        interactions = db.query(Interaction).all()
        total = len(interactions)
        sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
        type_counts = {}
        for inter in interactions:
            if inter.sentiment in sentiment_counts:
                sentiment_counts[inter.sentiment] += 1
            itype = inter.interaction_type or "Other"
            type_counts[itype] = type_counts.get(itype, 0) + 1

        # HCP count
        hcp_count = db.query(HCP).count()

        return {
            "total_interactions": total,
            "total_hcps": hcp_count,
            "sentiment_breakdown": sentiment_counts,
            "type_breakdown": type_counts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Keep old endpoint as alias
@app.get("/summary-report")
def summary_report_alias(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)

# ──────────────────────────────────────────────────────────────
# HCP ENDPOINTS
# ──────────────────────────────────────────────────────────────
@app.get("/hcp-history/{hcp_id}")
def get_hcp_history(hcp_id: int, db: Session = Depends(get_db)):
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            raise HTTPException(status_code=404, detail="HCP not found")
        interactions = db.query(Interaction).filter(
            Interaction.hcp_id == hcp_id
        ).order_by(desc(Interaction.created_at)).all()
        return {
            "hcp": {"id": hcp.id, "name": hcp.name},
            "interactions": [
                {
                    "id": i.id, "date": i.date, "interaction_type": i.interaction_type,
                    "sentiment": i.sentiment, "notes": i.notes
                } for i in interactions
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/hcps")
def get_all_hcps(q: str = Query(""), db: Session = Depends(get_db)):
    try:
        query = db.query(HCP)
        if q:
            query = query.filter(HCP.name.ilike(f"%{q}%"))
        hcps = query.limit(20).all()
        return [{"id": h.id, "name": h.name} for h in hcps]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
