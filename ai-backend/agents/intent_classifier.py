from langchain_core.messages import SystemMessage, HumanMessage


INTENT_LABELS = [
    "EMAIL_DRAFT",
    "REVIEW_FEEDBACK",
    "DB_QUERY",
    "IDEA_GENERATOR",
    "GENERAL",
]

STUDENT_ALLOWED = {"IDEA_GENERATOR", "GENERAL"}

SYSTEM_PROMPT = """You are an intent classifier for a College Project Management platform.
Given a user message, classify it into EXACTLY ONE of these categories:

- EMAIL_DRAFT — user wants to compose, write, draft, or send an email to students, groups, departments
- REVIEW_FEEDBACK — user wants to review, approve, reject, give feedback on a project submission
- DB_QUERY — user wants to see, list, check, view their groups, projects, members, statistics, data
- IDEA_GENERATOR — user wants help generating project ideas, topics, SDG-based projects, or brainstorming
- GENERAL — greetings, help questions, platform questions, anything that does not match above

Reply with ONLY the category label. Nothing else. No explanation."""


async def classify_intent(message: str, role: str, llm) -> str:
    """Return one of the INTENT_LABELS based on the message and role."""
    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"User role: {role}\nMessage: {message}"),
    ])

    raw = response.content.strip().upper().replace(" ", "_")

    # Find best match
    for label in INTENT_LABELS:
        if label in raw:
            # Students can only use IDEA_GENERATOR and GENERAL
            if role == "STUDENT" and label not in STUDENT_ALLOWED:
                return "GENERAL"
            return label

    return "GENERAL"
