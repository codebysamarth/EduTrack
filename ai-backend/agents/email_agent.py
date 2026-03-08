from langchain_core.messages import SystemMessage, HumanMessage
from tools import db_tools


SYSTEM_PROMPT = """You are an email drafting assistant for a College Project Management platform called EduTrack.
You draft professional, concise emails for faculty (guides, coordinators, HODs) to send to students or groups.

Given the context about recipients and the user's request, generate a well-formatted email.
Include:
- A clear subject line (on its own line, prefixed with "Subject: ")
- A professional greeting
- The message body
- A polite sign-off

Keep it professional but friendly. Use the sender's name if available.
Do NOT include email addresses in the body — those are handled separately."""


async def run_email_agent(state: dict) -> dict:
    """
    Detect recipient scope, fetch emails via db_tools, draft email with LLM.
    Returns draft + action buttons — does NOT send.
    """
    message = state.get("message", "")
    context = state.get("context", {})
    token = context.get("token", "")
    llm = state.get("llm")

    # Determine scope from context or message
    recipient_scope = _detect_scope(message, context)
    recipients = []
    scope_info = ""

    if recipient_scope == "GROUP":
        group_id = context.get("groupId", "")
        if group_id:
            result = await db_tools.get_group_members_with_emails(group_id, token)
            if result["success"]:
                recipients = [m["email"] for m in result["members"] if m["email"]]
                member_names = [m["name"] for m in result["members"] if m["name"]]
                scope_info = (
                    f"Group: {result['groupName']}\n"
                    f"Members: {', '.join(member_names)}\n"
                    f"Guide: {result['guideName']}"
                )
        if not recipients:
            # Try fetching all groups and use first one
            groups_result = await db_tools.get_my_groups(token)
            if groups_result["success"] and groups_result["data"]:
                first_group = groups_result["data"][0]
                gid = first_group.get("id", "")
                result = await db_tools.get_group_members_with_emails(gid, token)
                if result["success"]:
                    recipients = [m["email"] for m in result["members"] if m["email"]]
                    scope_info = f"Group: {result['groupName']}"

    elif recipient_scope == "DEPARTMENT":
        dept_id = context.get("departmentId", "")
        year = context.get("year", "")
        result = await db_tools.get_department_students_emails(dept_id, year, token)
        if result["success"]:
            recipients = [s["email"] for s in result["students"] if s["email"]]
            scope_info = f"Department students: {result['count']} recipients"

    # Build LLM prompt
    user_prompt = f"""Draft an email based on this request:
"{message}"

Sender context:
- Role: {context.get('role', 'Faculty')}
- Name: {context.get('userName', 'Faculty Member')}

Recipient scope: {recipient_scope}
{scope_info}

Number of recipients: {len(recipients)}"""

    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])

    draft = response.content.strip()

    # Extract subject from draft if present
    subject = "EduTrack Notification"
    for line in draft.split("\n"):
        if line.strip().lower().startswith("subject:"):
            subject = line.strip()[len("Subject:"):].strip()
            break

    action_buttons = []
    action_context = {
        "draftContent": draft,
        "recipients": recipients,
        "subject": subject,
        "recipientScope": recipient_scope,
    }

    if recipients:
        action_buttons.append({"label": "Send Email", "action": "SEND_EMAIL"})
    action_buttons.append({"label": "Regenerate", "action": "REGENERATE"})

    return {
        "response": draft,
        "agentUsed": "email_agent",
        "suggestedActions": ["Send this email", "Edit and send", "Change recipients"],
        "actionButtons": action_buttons,
        "actionContext": action_context,
    }


def _detect_scope(message: str, context: dict) -> str:
    """Detect if user wants to email group, department, or year-wide."""
    msg_lower = message.lower()

    if context.get("groupId") or "group" in msg_lower:
        return "GROUP"
    if "department" in msg_lower or "dept" in msg_lower or context.get("departmentId"):
        return "DEPARTMENT"
    if "year" in msg_lower or "batch" in msg_lower or "all students" in msg_lower:
        return "DEPARTMENT"

    return "GROUP"
