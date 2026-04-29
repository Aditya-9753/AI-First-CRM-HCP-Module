import os
import json
from typing import TypedDict, Annotated, Sequence, Dict, List
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from database import SessionLocal
from models import Interaction, HCP, FollowUp
from suggestions import generate_llm_suggestions
from sqlalchemy import desc
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY", "")
llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=groq_api_key)

# ─────────────────────────────────────────────────────────────
# TOOL 1: Log Interaction — extracts + stores, returns fields
# ─────────────────────────────────────────────────────────────
@tool
def LogInteractionTool(
    hcp_name: str,
    interaction_type: str,
    date: str,
    time: str,
    notes: str,
    topics_discussed: str = "",
    materials_shared: str = "",
    samples_distributed: str = "",
    sentiment: str = "Neutral",
    outcomes: str = "",
    follow_up_actions: str = ""
) -> str:
    """
    Extract entities from natural language, summarize the interaction, and save to the database.
    Use today's date (YYYY-MM-DD) and current time (HH:MM) if not specified.
    Detect sentiment from context: positive words = Positive, concern/objection = Negative, otherwise Neutral.
    """
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.name.ilike(f"%{hcp_name}%")).first()
        if not hcp:
            hcp = HCP(name=hcp_name)
            db.add(hcp)
            db.commit()
            db.refresh(hcp)

        new_interaction = Interaction(
            hcp_id=hcp.id,
            interaction_type=interaction_type,
            date=date,
            time=time,
            notes=notes,
            topics_discussed=topics_discussed,
            materials_shared=materials_shared,
            samples_distributed=samples_distributed,
            sentiment=sentiment,
            outcomes=outcomes
        )
        db.add(new_interaction)
        db.commit()
        db.refresh(new_interaction)

        if follow_up_actions:
            for action in follow_up_actions.split(","):
                if action.strip():
                    fu = FollowUp(interaction_id=new_interaction.id, action_item=action.strip())
                    db.add(fu)
            db.commit()

        return json.dumps({
            "success": True,
            "interaction_id": new_interaction.id,
            "summary": f"Interaction with {hcp.name} logged. Sentiment: {sentiment}.",
            # These extracted_fields are parsed by main.py to auto-fill the form
            "extracted_fields": {
                "hcp_name": hcp_name,
                "interaction_type": interaction_type,
                "date": date,
                "time": time,
                "notes": notes,
                "topics_discussed": topics_discussed,
                "materials_shared": materials_shared,
                "samples_distributed": samples_distributed,
                "sentiment": sentiment,
                "outcomes": outcomes,
                "follow_up_actions": follow_up_actions,
            }
        })
    except Exception as e:
        db.rollback()
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────
# TOOL 2: Edit Interaction
# ─────────────────────────────────────────────────────────────
@tool
def EditInteractionTool(interaction_id: int, field_to_update: str, new_value: str) -> str:
    """Update a specific field of an existing interaction record."""
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return json.dumps({"success": False, "error": "Interaction not found."})
        if hasattr(interaction, field_to_update):
            setattr(interaction, field_to_update, new_value)
            db.commit()
            return json.dumps({"success": True, "message": f"Updated {field_to_update} to '{new_value}'."})
        return json.dumps({"success": False, "error": "Field not found."})
    except Exception as e:
        db.rollback()
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────
# TOOL 3: Suggest Follow-Up
# ─────────────────────────────────────────────────────────────
@tool
def SuggestFollowUpTool(hcp_name: str, interaction_notes: str, sentiment: str) -> str:
    """
    Generate 3 intelligent, context-aware follow-up suggestions using LLM.
    Uses full HCP interaction history for personalized recommendations.
    Falls back to rule-based suggestions if LLM fails.
    """
    db = SessionLocal()
    try:
        suggestions = generate_llm_suggestions(
            db=db,
            hcp_name=hcp_name,
            notes=interaction_notes,
            sentiment=sentiment
        )
        return json.dumps({
            "hcp_name": hcp_name,
            "sentiment": sentiment,
            "suggestions": suggestions,
            "source": "llm"
        })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────
# TOOL 4: Fetch HCP History
# ─────────────────────────────────────────────────────────────
@tool
def FetchHCPHistoryTool(hcp_name: str) -> str:
    """Retrieve past interactions for a specific HCP and provide a sentiment trend summary."""
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.name.ilike(f"%{hcp_name}%")).first()
        if not hcp:
            return json.dumps({"success": False, "message": f"No HCP found matching '{hcp_name}'."})
        interactions = db.query(Interaction).filter(
            Interaction.hcp_id == hcp.id
        ).order_by(desc(Interaction.created_at)).limit(5).all()
        trend = {"Positive": 0, "Neutral": 0, "Negative": 0}
        history = []
        for inter in interactions:
            if inter.sentiment in trend:
                trend[inter.sentiment] += 1
            history.append({
                "id": inter.id, "date": inter.date,
                "type": inter.interaction_type,
                "sentiment": inter.sentiment,
                "notes": inter.notes
            })
        return json.dumps({
            "hcp_name": hcp.name, "total": len(history),
            "sentiment_trend": trend, "history": history
        })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────
# TOOL 5: Generate Summary Report
# ─────────────────────────────────────────────────────────────
@tool
def GenerateSummaryReportTool(timeframe: str = "all time") -> str:
    """Generate an aggregated summary report across all recent interactions."""
    db = SessionLocal()
    try:
        interactions = db.query(Interaction).order_by(desc(Interaction.created_at)).limit(50).all()
        total = len(interactions)
        sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
        for inter in interactions:
            if inter.sentiment in sentiment_counts:
                sentiment_counts[inter.sentiment] += 1
        hcp_count = db.query(HCP).count()
        report = (
            f"Report for {timeframe}: {total} total interactions across {hcp_count} HCPs. "
            f"Positive: {sentiment_counts['Positive']}, "
            f"Neutral: {sentiment_counts['Neutral']}, "
            f"Negative: {sentiment_counts['Negative']}."
        )
        return json.dumps({
            "report": report, "total": total, "hcp_count": hcp_count,
            "sentiment_breakdown": sentiment_counts
        })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────
# LANGGRAPH AGENT
# ─────────────────────────────────────────────────────────────
tools = [LogInteractionTool, EditInteractionTool, SuggestFollowUpTool, FetchHCPHistoryTool, GenerateSummaryReportTool]

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

llm_with_tools = llm.bind_tools(tools)

SYSTEM_PROMPT = """You are an AI Copilot for a Life Sciences CRM system used by pharmaceutical field sales representatives.
Your job is to help them log HCP interactions, retrieve history, suggest follow-ups, and generate reports.

You have 5 tools available:
1. LogInteractionTool – Extract structured data from natural language and log to DB. Always use today's date if not mentioned.
2. EditInteractionTool – Update a specific field of an existing logged interaction.
3. SuggestFollowUpTool – Provide 5 next best actions based on HCP sentiment.
4. FetchHCPHistoryTool – Retrieve past interactions for an HCP with sentiment trend.
5. GenerateSummaryReportTool – Aggregate summary of recent interactions.

IMPORTANT: When a user describes a meeting (e.g., "Met Dr. X today, discussed Y..."), ALWAYS call LogInteractionTool.
Be concise, professional, and data-driven in your responses.
"""

def agent_node(state: AgentState):
    messages = state["messages"]
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

def tool_node(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    tool_messages = []
    for tool_call in last_message.tool_calls:
        matched = next((t for t in tools if t.name == tool_call["name"]), None)
        if matched:
            result = matched.invoke(tool_call["args"])
            tool_messages.append(
                ToolMessage(content=result, tool_call_id=tool_call["id"], name=tool_call["name"])
            )
    return {"messages": tool_messages}

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END

graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", agent_node)
graph_builder.add_node("tools", tool_node)
graph_builder.set_entry_point("agent")
graph_builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph_builder.add_edge("tools", "agent")
graph = graph_builder.compile()

# Session memory
sessions: Dict[str, List[BaseMessage]] = {}

def process_chat(session_id: str, user_message: str):
    if session_id not in sessions:
        sessions[session_id] = [SystemMessage(content=SYSTEM_PROMPT)]
    sessions[session_id].append(HumanMessage(content=user_message))

    result = graph.invoke({"messages": sessions[session_id]})
    sessions[session_id] = result["messages"]

    last_msg = result["messages"][-1]

    tools_called = []
    extracted_fields = {}

    for msg in reversed(result["messages"]):
        if isinstance(msg, HumanMessage):
            break
        if isinstance(msg, ToolMessage):
            tools_called.append(msg.name)
            # Extract form-fill data from LogInteractionTool result
            if msg.name == "LogInteractionTool":
                try:
                    parsed = json.loads(msg.content)
                    if parsed.get("success") and "extracted_fields" in parsed:
                        extracted_fields = parsed["extracted_fields"]
                except Exception:
                    pass

    tools_called.reverse()

    return {
        "response": last_msg.content,
        "tools_called": list(set(tools_called)),
        "extracted_fields": extracted_fields,
    }
