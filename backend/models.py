from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class HCP(Base):
    __tablename__ = "hcps"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    specialty = Column(String)
    contact_email = Column(String)
    
    interactions = relationship("Interaction", back_populates="hcp")

class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(Integer, primary_key=True, index=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id"), nullable=False)
    interaction_type = Column(String, nullable=False)
    date = Column(String, nullable=False)
    time = Column(String, nullable=False)
    notes = Column(Text)
    topics_discussed = Column(Text)
    materials_shared = Column(String)
    samples_distributed = Column(String)
    sentiment = Column(String)
    outcomes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    hcp = relationship("HCP", back_populates="interactions")
    follow_ups = relationship("FollowUp", back_populates="interaction")

class FollowUp(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, index=True)
    interaction_id = Column(Integer, ForeignKey("interactions.id"), nullable=False)
    action_item = Column(String, nullable=False)
    status = Column(String, default="Pending")
    due_date = Column(String)
    
    interaction = relationship("Interaction", back_populates="follow_ups")
