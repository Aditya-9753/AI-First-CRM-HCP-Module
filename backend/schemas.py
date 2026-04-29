from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class InteractionCreate(BaseModel):
    hcp_name: str
    interaction_type: str
    date: str
    time: str
    notes: Optional[str] = ""
    topics_discussed: Optional[str] = ""
    materials_shared: Optional[str] = ""
    samples_distributed: Optional[str] = ""
    sentiment: Optional[str] = "Neutral"
    outcomes: Optional[str] = ""
    follow_up_actions: Optional[str] = ""

class InteractionEdit(BaseModel):
    field: str
    value: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
