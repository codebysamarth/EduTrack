from typing import TypedDict, Any

from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

from config import OLLAMA_BASE_URL, OLLAMA_MODEL
from agents.intent_classifier import classify_intent
from agents.email_agent import run_email_agent
from agents.review_agent import run_review_agent
from agents.db_query_agent import run_db_query_agent
from agents.idea_generator_agent import run_idea_generator_agent


# ─── LLM instance (shared across all agents) ────────────────────────────

_llm = ChatOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
    temperature=0.7,
)


def get_llm():
    return _llm


# ─── State schema ────────────────────────────────────────────────────────

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


# ─── Node functions ──────────────────────────────────────────────────────

async def classify_node(state: AgentState) -> dict:
    """Classify intent and inject LLM into state."""
    intent = await classify_intent(
        state["message"], state["userRole"], _llm
    )
    return {"intent": intent, "llm": _llm}


async def general_node(state: AgentState) -> dict:
    """Handle general conversation / greetings / help."""
    response = await _llm.ainvoke([
        SystemMessage(
            content=(
                "You are EduTrack, a helpful assistant for a College Project Management platform. "
                "You help faculty and students with platform-related questions.\n"
                "Be concise, professional, and friendly.\n"
                "If someone greets you, greet back and briefly explain what you can do:\n"
                "- Draft emails to students/groups\n"
                "- Review project submissions\n"
                "- Query groups and project data\n"
                "- Generate project idea prompts (students)\n"
                "Keep replies short (2-4 sentences)."
            )
        ),
        HumanMessage(content=state["message"]),
    ])
    return {
        "response": response.content.strip(),
        "agentUsed": "general",
        "suggestedActions": [],
        "actionButtons": [],
        "actionContext": {},
        "isTemplate": False,
    }


async def email_node(state: AgentState) -> dict:
    return await run_email_agent(state)


async def review_node(state: AgentState) -> dict:
    return await run_review_agent(state)


async def db_query_node(state: AgentState) -> dict:
    return await run_db_query_agent(state)


async def idea_generator_node(state: AgentState) -> dict:
    return await run_idea_generator_agent(state)


# ─── Routing ─────────────────────────────────────────────────────────────

def route_intent(state: AgentState) -> str:
    """Return the node key based on classified intent."""
    intent = state.get("intent", "GENERAL")
    mapping = {
        "EMAIL_DRAFT": "email",
        "REVIEW_FEEDBACK": "review",
        "DB_QUERY": "db_query",
        "IDEA_GENERATOR": "idea_generator",
        "GENERAL": "general",
    }
    return mapping.get(intent, "general")


# ─── Graph construction ──────────────────────────────────────────────────

def build_graph():
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("classify", classify_node)
    graph.add_node("general", general_node)
    graph.add_node("email", email_node)
    graph.add_node("review", review_node)
    graph.add_node("db_query", db_query_node)
    graph.add_node("idea_generator", idea_generator_node)

    # Entry edge
    graph.add_edge(START, "classify")

    # Conditional routing from classify
    graph.add_conditional_edges(
        "classify",
        route_intent,
        {
            "email": "email",
            "review": "review",
            "db_query": "db_query",
            "idea_generator": "idea_generator",
            "general": "general",
        },
    )

    # All agents terminate
    graph.add_edge("general", END)
    graph.add_edge("email", END)
    graph.add_edge("review", END)
    graph.add_edge("db_query", END)
    graph.add_edge("idea_generator", END)

    return graph.compile()


# Pre-compile at module load
compiled_graph = build_graph()
