from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ChatRequest(BaseModel):
    message: str
    userRole: str
    context: Dict[str, Any] = {}


class ActionRequest(BaseModel):
    actionType: str
    agentUsed: str
    draftContent: str
    context: Dict[str, Any] = {}


class ActionResponse(BaseModel):
    success: bool
    message: str
    details: Dict[str, Any] = {}


class ChatResponse(BaseModel):
    response: str
    agentUsed: str
    suggestedActions: List[str] = []
    isTemplate: bool = False
    actionButtons: List[Dict[str, str]] = []
    actionContext: Dict[str, Any] = {}


class HealthResponse(BaseModel):
    status: str
    model: str
    ollamaConnected: bool
    gmailConnected: bool
    message: str