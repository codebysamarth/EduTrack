import json
from datetime import datetime, timedelta
from langchain_core.messages import SystemMessage, HumanMessage
from .intent_classifier import AgentState
from tools import create_calendar_event, get_group_members_with_emails, search_all_groups, send_email

CALENDAR_SYSTEM_PROMPT = """You are the Calendar & Scheduling Agent for EduTrack.
Your job is to extract meeting details from the user's request.
The current date and time is: {current_time}

Extract the following information:
1. title: Title of the meeting.
2. start_datetime: ISO 8601 formatted start datetime string (e.g. "2026-05-16T10:00:00").
3. end_datetime: ISO 8601 formatted end datetime string (default 1 hour after start).
4. emails: A list of specific email addresses mentioned.
5. group_names: A list of group names mentioned (e.g., ["Group 5", "CS-Group 2"]).
6. email_draft: A professional email draft inviting the students to this meeting.
7. add_meet_link: boolean (true by default unless user specifies offline).

Return ONLY a valid JSON object:
{{
    "title": "...",
    "start_datetime": "...",
    "end_datetime": "...",
    "emails": [],
    "group_names": [],
    "email_draft": "...",
    "add_meet_link": true
}}
Do not return markdown formatting, just the raw JSON string."""

async def run_calendar_agent(state: AgentState) -> dict:
    llm = state.get("llm")
    if not llm:
        from graph.orchestrator import get_llm
        llm = get_llm()

    token = state["context"].get("token")
    if not token:
        return {
            "response": "Authentication missing. Cannot schedule meeting.",
            "agentUsed": "calendar",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prompt_msg = f"User message: {state['message']}"

    extract_res = await llm.ainvoke([
        SystemMessage(content=CALENDAR_SYSTEM_PROMPT.format(current_time=now_str)),
        HumanMessage(content=prompt_msg),
    ])

    try:
        raw_json = extract_res.content.strip()
        if raw_json.startswith("```json"):
            raw_json = raw_json[7:-3].strip()
        parsed = json.loads(raw_json)
    except Exception as e:
        return {
            "response": "I couldn't parse the meeting details from your request. Please specify the date, time, and who to invite.",
            "agentUsed": "calendar",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Resolve group names to emails
    final_emails = set(parsed.get("emails", []))
    group_names = parsed.get("group_names", [])
    
    if group_names:
        for gn in group_names:
            search_res = await search_all_groups(token=token, group_name=gn)
            groups = search_res.get("data", [])
            if groups:
                # Use first matched group
                group_id = groups[0].get("id")
                members_res = await get_group_members_with_emails(group_id, token=token)
                for member in members_res.get("members", []):
                    if member.get("email"):
                        final_emails.add(member.get("email"))

    parsed["emails"] = list(final_emails)

    if not parsed.get("start_datetime"):
        return {
            "response": "Please specify a date and time for the meeting.",
            "agentUsed": "calendar",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }
        
    if not parsed.get("emails"):
        return {
            "response": "No valid emails or groups found to invite.",
            "agentUsed": "calendar",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Check if this is a confirmation or just a draft
    is_confirmed = state["context"].get("isActionConfirmed", False)

    if is_confirmed:
        # User clicked Confirm! Create calendar event
        result = create_calendar_event(
            title=parsed.get("title", "Project Review Meeting"),
            start_datetime=parsed.get("start_datetime"),
            end_datetime=parsed.get("end_datetime"),
            attendee_emails=parsed.get("emails", []),
            description=parsed.get("email_draft", ""),
            add_meet_link=parsed.get("add_meet_link", True)
        )

        if result.get("success"):
            meet_link = result.get("meetLink")
            meet_text = f" Meet link: {meet_link}" if meet_link else ""
            
            # Optionally send separate email draft if requested
            send_res = send_email(
                to_emails=parsed.get("emails", []),
                subject=parsed.get("title", "Project Review Meeting"),
                body=f"{parsed.get('email_draft', '')}\n{meet_text}"
            )
            
            return {
                "response": f"✅ Meeting scheduled successfully! Calendar invite sent to {len(parsed['emails'])} participants.{meet_text}",
                "agentUsed": "calendar",
                "suggestedActions": ["View my groups", "Check project status"],
                "actionButtons": [],
                "actionContext": {},
                "isTemplate": False,
            }
        else:
            return {
                "response": f"❌ Failed to create calendar event: {result.get('error')}",
                "agentUsed": "calendar",
                "suggestedActions": [],
                "actionButtons": [],
                "actionContext": {},
                "isTemplate": False,
            }

    # Preview state - return action button
    preview_text = (
        f"📅 **{parsed.get('title', 'Meeting')}**\n"
        f"**Start:** {parsed.get('start_datetime')}\n"
        f"**End:** {parsed.get('end_datetime')}\n"
        f"**Invitees:** {', '.join(parsed.get('emails', []))}\n"
        f"**Google Meet:** {'Yes' if parsed.get('add_meet_link') else 'No'}\n\n"
        f"**Email Draft:**\n\n> {parsed.get('email_draft', '')}"
    )

    return {
        "response": f"I have prepared the meeting details. Please review and confirm:\n\n{preview_text}",
        "agentUsed": "calendar",
        "suggestedActions": [],
        "actionButtons": [
            {"label": "Schedule & Send Invites", "action": "CONFIRM_CALENDAR", "variant": "primary"}
        ],
        "actionContext": parsed, # Store parsed data in context to be used in next request
        "isTemplate": False,
    }
