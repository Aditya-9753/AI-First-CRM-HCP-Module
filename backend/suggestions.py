"""
LLM-Powered Follow-Up Suggestion Engine
Uses Groq API with full HCP history context for intelligent, personalized suggestions.
"""
import os
from groq import Groq
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Interaction, HCP

load_dotenv()
_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
MODEL = "llama-3.3-70b-versatile"

# ─────────────────────────────────────────────────────────────
# Rule-based fallback (used when LLM fails)
# ─────────────────────────────────────────────────────────────
def _rule_based(sentiment: str) -> list[str]:
    if sentiment.lower() == "positive":
        return [
            "Schedule a detailed product demo within the next week",
            "Share the latest clinical trial data pack via email",
            "Invite to an upcoming KOL roundtable or CME webinar",
        ]
    elif sentiment.lower() == "negative":
        return [
            "Schedule an MSL visit to address clinical objections in depth",
            "Send a comparative efficacy/safety data sheet by end of week",
            "Escalate pricing concerns to the Key Account Manager",
        ]
    return [
        "Send a polite follow-up email summarizing today's discussion",
        "Schedule a check-in call in two weeks",
        "Share relevant patient case studies from similar practices",
    ]

# ─────────────────────────────────────────────────────────────
# Core LLM suggestion function
# ─────────────────────────────────────────────────────────────
def generate_llm_suggestions(db: Session, hcp_name: str, notes: str, sentiment: str = "Neutral") -> list[str]:
    """
    Fetch HCP history from DB, build context-rich prompt, call Groq LLM,
    and return 3 intelligent follow-up suggestions.
    Falls back to rule-based logic if LLM call fails.
    """
    # 1. Fetch HCP past interactions
    hcp = db.query(HCP).filter(HCP.name.ilike(f"%{hcp_name}%")).first()
    past_interactions = []
    if hcp:
        past = db.query(Interaction).filter(
            Interaction.hcp_id == hcp.id
        ).order_by(desc(Interaction.created_at)).limit(5).all()
        past_interactions = past

    # 2. Format past history for the prompt
    if past_interactions:
        history_lines = []
        for idx, inter in enumerate(past_interactions, 1):
            history_lines.append(
                f"  {idx}. [{inter.date}] {inter.interaction_type} — "
                f"Sentiment: {inter.sentiment or 'Unknown'} — "
                f"Notes: {(inter.notes or inter.topics_discussed or 'No notes')[:200]}"
            )
        past_notes_str = "\n".join(history_lines)
    else:
        past_notes_str = "  No previous interactions recorded for this HCP."

    # 3. Build context-aware prompt
    prompt = f"""You are an expert pharmaceutical sales assistant helping a field representative plan their next steps.

Analyze the current interaction and the doctor's full history, then suggest exactly 3 smart, specific, and actionable follow-up actions.

Doctor Name: {hcp_name}
Current Sentiment: {sentiment}

Current Interaction Notes:
{notes or 'No notes provided.'}

Past Interaction History (most recent first):
{past_notes_str}

Instructions:
- Each suggestion must be concrete and time-bound where possible
- Consider the sentiment trend across past interactions
- Be specific to pharma/life sciences context
- If negative sentiment: focus on objection handling, MSL support, peer evidence
- If positive sentiment: focus on advancing the relationship, demos, trials
- If neutral: focus on nurturing, education, re-engagement

Return ONLY 3 bullet points starting with "•", one per line. No extra text, no numbering, no explanation."""

    # 4. Call Groq LLM
    try:
        response = _client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a concise pharmaceutical sales strategy assistant. Always return exactly 3 bullet points starting with •."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300,
        )
        raw = response.choices[0].message.content.strip()

        # 5. Parse bullet points robustly
        suggestions = []
        for line in raw.split("\n"):
            line = line.strip().lstrip("•-*123456789.) ").strip()
            if line and len(line) > 10:
                suggestions.append(line)
        
        # Return top 3, fall back if parsing fails
        if len(suggestions) >= 1:
            return suggestions[:3]
        return _rule_based(sentiment)

    except Exception as e:
        print(f"[SuggestionEngine] LLM call failed: {e}. Using rule-based fallback.")
        return _rule_based(sentiment)
