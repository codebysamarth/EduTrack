from typing import TypedDict, Any
import asyncio
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END

import itertools

from config import (
    LLM_PROVIDER,
    GEMINI_API_KEYS, GEMINI_MODEL,
    OPENAI_API_KEY, OPENAI_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
)

# Global key rotation state
_gemini_key_cycle = itertools.cycle(GEMINI_API_KEYS) if GEMINI_API_KEYS else iter([])
_current_llm = None
_failed_keys = set()  # Track temporarily failed keys

from agents.intent_classifier import classify_intent
from agents.email_agent import run_email_agent
from agents.review_agent import run_review_agent
from agents.db_query_agent import run_db_query_agent
from agents.idea_generator_agent import run_idea_generator_agent


# ─── LLM instance with error handling & key rotation ────────────────────

def _create_llm():
    """Create LLM instance with next available API key."""
    if LLM_PROVIDER == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        # Try to get next available key (skip recently failed ones)
        for _ in range(len(GEMINI_API_KEYS)):
            try_key = next(_gemini_key_cycle)
            if try_key not in _failed_keys:
                print(f"🔑 Using Gemini API key: ...{try_key[-8:]}")
                return ChatGoogleGenerativeAI(
                    model=GEMINI_MODEL,
                    google_api_key=try_key,
                    temperature=0.7,
                )
        
        # All keys failed recently, clear the set and try again
        _failed_keys.clear()
        fallback_key = next(_gemini_key_cycle)
        print(f"🔄 Retrying with key: ...{fallback_key[-8:]}")
        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=fallback_key,
            temperature=0.7,
        )
    elif LLM_PROVIDER == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0.7,
        )
    else:  # openai
        from langchain_openai import ChatOpenAI
        _REASONING_MODELS = {"o1", "o1-mini", "o3", "o3-mini", "o1-preview"}
        kwargs = {"model": OPENAI_MODEL, "api_key": OPENAI_API_KEY}
        if not any(OPENAI_MODEL.startswith(m) for m in _REASONING_MODELS):
            kwargs["temperature"] = 0.7
        return ChatOpenAI(**kwargs)

async def _create_llm_with_retry():
    """Create LLM with quota error retry logic."""
    global _current_llm
    
    if LLM_PROVIDER != "gemini":
        if not _current_llm:
            _current_llm = _create_llm()
        return _current_llm
    
    # For Gemini, always try to create fresh LLM to ensure key rotation
    max_retries = len(GEMINI_API_KEYS) + 1
    
    for attempt in range(max_retries):
        try:
            _current_llm = _create_llm()
            # Test the LLM with a simple call
            await _current_llm.ainvoke([HumanMessage(content="test")])
            return _current_llm
        except Exception as e:
            error_str = str(e).lower()
            
            # Check for quota exhaustion
            if "resource_exhausted" in error_str or "quota" in error_str or "429" in error_str:
                # Mark current key as temporarily failed
                current_key = getattr(_current_llm, 'google_api_key', '') if _current_llm else ''
                if current_key:
                    _failed_keys.add(current_key)
                    print(f"💥 Quota exhausted for key ...{current_key[-8:]} (attempt {attempt+1}/{max_retries})")
                
                if attempt < max_retries - 1:
                    # Wait before trying next key
                    await asyncio.sleep(2 ** attempt)  # exponential backoff
                    continue
            
            # For other errors or final attempt, re-raise
            print(f"❌ LLM creation failed: {e}")
            raise e
    
    raise Exception(f"All {len(GEMINI_API_KEYS)} API keys failed")

def get_llm():
    """Get current LLM instance (synchronous version)."""
    global _current_llm
    if not _current_llm:
        _current_llm = _create_llm()
    return _current_llm

async def get_llm_async():
    """Get LLM instance with async retry logic."""
    return await _create_llm_with_retry()


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
    llm = await get_llm_async()
    intent = await classify_intent(
        state["message"], state["userRole"], llm
    )
    return {"intent": intent, "llm": llm}


async def general_node(state: AgentState) -> dict:
    """Handle general conversation / greetings / help — role-aware."""
    role = state.get("userRole", "")

    role_capabilities = {
        "ADMIN": (
            "You are speaking to an ADMIN who has full platform access.\n"
            "They can:\n"
            "- Query any data: departments, faculty, students, groups, projects across the entire platform\n"
            "- Draft & send emails to any students/groups/faculty\n"
            "- Review and approve/reject project submissions\n"
            "- View department HODs, coordinators, guides, and student counts\n"
            "- Get project status breakdowns and statistics"
        ),
        "HOD": (
            "You are speaking to a Head of Department (HOD).\n"
            "They can:\n"
            "- Query data about their department: faculty, students, groups, projects\n"
            "- Draft & send emails to students/groups in their department\n"
            "- Review and approve/reject project submissions\n"
            "- View coordinators, guides, and student info in their department"
        ),
        "COORDINATOR": (
            "You are speaking to a COORDINATOR.\n"
            "They can:\n"
            "- Query all groups and projects in their department\n"
            "- Review and approve/reject project submissions\n"
            "- Publish approved projects to the showcase\n"
            "- Create, edit, and manage groups (assign guides, add/remove students)\n"
            "- Approve or reject student-formed groups\n"
            "- Draft & send emails to their groups/students/faculty\n"
            "- View faculty and student data in their department\n"
            "- Export groups and projects to Excel\n"
            "- View project status analytics and charts"
        ),
        "GUIDE": (
            "You are speaking to a project GUIDE (faculty mentor).\n"
            "They can:\n"
            "- Query groups and projects assigned to them\n"
            "- Draft & send emails to their group members\n"
            "- Review project submissions from their groups"
        ),
        "STUDENT": (
            "You are speaking to a STUDENT.\n"
            "They can:\n"
            "- Generate unique project ideas based on SDGs and domains\n"
            "- View their group and project information\n"
            "- Get help with project-related questions"
        ),
    }

    capabilities = role_capabilities.get(role, role_capabilities["STUDENT"])

    system_prompt = (
        "You are EduTrack, an AI assistant for a College Project Management platform.\n"
        f"{capabilities}\n\n"
        "Be friendly, professional, and helpful.\n"
        "When someone greets you or asks what you can do, explain your capabilities "
        "based on their role in a clear, organized way.\n"
        "Use bullet points for listing capabilities.\n"
        "Keep replies concise but informative (3-6 sentences for greetings, more for detailed questions)."
    )

    llm = state.get("llm") or await get_llm_async()
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
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
