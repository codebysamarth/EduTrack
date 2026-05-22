from typing import TypedDict, Any

class AgentState(TypedDict):
    message: str
    userRole: str
    context: dict[str, Any]
    intent: str
    response: str
    agentUsed: str
    suggestedActions: list[str]
    isTemplate: bool
    actionButtons: list[dict[str, str]]
    actionContext: dict[str, Any]
    llm: Any
