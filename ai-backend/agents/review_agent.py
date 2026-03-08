from langchain_core.messages import SystemMessage, HumanMessage
from tools import db_tools


APPROVAL_PROMPT = """You are a project review assistant for a College Project Management platform.
The guide wants to APPROVE this project. Generate a professional approval review comment.

Include:
- Acknowledgment of the project's strengths
- Brief positive feedback
- Any minor suggestions for improvement
- Encouragement to continue

Keep it concise (3-5 sentences). Professional but supportive tone."""

REJECTION_PROMPT = """You are a project review assistant for a College Project Management platform.
The guide wants to REJECT this project and ask for revisions.

Generate a constructive rejection review with:
- Specific areas that need improvement
- Clear, actionable feedback
- Encouraging tone — frame as "needs revision" not "failure"
- What they should fix before resubmitting

Keep it concise (4-6 sentences). Be specific about what needs changing."""


async def run_review_agent(state: dict) -> dict:
    """
    Detect approval/rejection intent, fetch project, generate review draft.
    Returns draft + POST_REVIEW action button.
    """
    message = state.get("message", "")
    context = state.get("context", {})
    token = context.get("token", "")
    llm = state.get("llm")

    project_id = context.get("projectId", "")
    is_approval = _detect_approval_intent(message)

    # Fetch project details for context
    project_info = ""
    project_data = {}
    if project_id:
        result = await db_tools.get_project_details(project_id, token)
        if result["success"]:
            project_data = result["data"]
            project_info = _format_project_info(project_data)

    system = APPROVAL_PROMPT if is_approval else REJECTION_PROMPT

    user_prompt = f"""Guide's message: "{message}"

Project details:
{project_info if project_info else "No project details available — guide should select a project first."}

Generate the review comment now."""

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=user_prompt),
    ])

    draft = response.content.strip()

    action_buttons = [
        {"label": "Submit Review", "action": "POST_REVIEW"},
        {"label": "Regenerate", "action": "REGENERATE"},
    ]

    action_context = {
        "draftContent": draft,
        "projectId": project_id,
        "isApproved": is_approval,
        "projectTitle": project_data.get("title", ""),
    }

    status_word = "approval" if is_approval else "revision request"

    return {
        "response": draft,
        "agentUsed": "review_agent",
        "suggestedActions": [
            f"Submit this {status_word}",
            "Edit before submitting",
            "Switch to " + ("reject" if is_approval else "approve"),
        ],
        "actionButtons": action_buttons,
        "actionContext": action_context,
    }


def _detect_approval_intent(message: str) -> bool:
    """Detect if the user wants to approve or reject."""
    msg_lower = message.lower()
    rejection_words = {"reject", "revision", "revise", "decline", "deny", "not approve", "needs work", "redo"}
    for word in rejection_words:
        if word in msg_lower:
            return False
    return True


def _format_project_info(project: dict) -> str:
    """Format project data into readable context for the LLM."""
    lines = []
    if project.get("title"):
        lines.append(f"Title: {project['title']}")
    if project.get("description"):
        lines.append(f"Description: {project['description']}")
    if project.get("domain"):
        lines.append(f"Domain: {project['domain']}")
    if project.get("sdgGoals"):
        lines.append(f"SDG Goals: {', '.join(project['sdgGoals'])}")
    if project.get("status"):
        lines.append(f"Current Status: {project['status']}")

    group = project.get("group", {})
    if group:
        lines.append(f"Group: {group.get('name', 'N/A')}")
        members = group.get("members", [])
        if members:
            names = [m.get("student", {}).get("name", "") for m in members]
            lines.append(f"Members: {', '.join(n for n in names if n)}")

    return "\n".join(lines) if lines else "No project information available"
