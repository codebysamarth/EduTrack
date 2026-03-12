from langchain_core.messages import SystemMessage, HumanMessage
from tools import db_tools
import re


SYSTEM_PROMPT = """You are an email drafting assistant for a College Project Management platform called EduTrack.
You draft professional, concise emails for faculty (guides, coordinators, HODs, admins) to send to students, groups, or faculty.

Given the context about the sender, recipients, and the user's request, generate a well-formatted email.
Include:
- A clear subject line (on its own line, prefixed with "Subject: ")
- A professional greeting appropriate for the audience
- The message body
- A polite sign-off using the sender's actual name and designation

Keep it professional but friendly. Use the sender's actual name for the sign-off.
Do NOT include email addresses in the body — those are handled separately.
Do NOT use generic placeholders like "Faculty Member" — use the actual name provided."""


async def run_email_agent(state: dict) -> dict:
    """
    Detect recipient scope, fetch emails via db_tools, draft email with LLM.
    Returns draft + recipient list + action buttons — does NOT send.
    """
    message = state.get("message", "")
    context = state.get("context", {})
    token = context.get("token", "")
    role = context.get("role", "")
    llm = state.get("llm")

    # Determine scope from message + role
    recipient_scope = _detect_scope(message, context, role)

    # Fetch recipients based on scope
    recipients, recipient_names, scope_info = await _fetch_recipients(
        recipient_scope, message, context, token, role
    )

    sender_name = context.get("userName", "") or "Team"
    role_label = {
        "ADMIN": "Admin",
        "HOD": "Head of Department",
        "COORDINATOR": "Coordinator",
        "GUIDE": "Project Guide",
        "STUDENT": "Student",
    }.get(role, role)

    # If no recipients found, return a helpful message instead of drafting
    if not recipients:
        warning = scope_info if scope_info else "Could not determine recipients for this email."
        return {
            "response": (
                f"📧 **Email could not be drafted**\n\n{warning}\n\n"
                "Please specify the recipients more clearly. Examples:\n"
                "- \"Write email to ENTC-TY-A-G1 regarding...\"\n"
                "- \"Email guide of group CSE-FIN-A-G1 about...\"\n"
                "- \"Send email to all students about...\"\n"
                "- \"Write email to Prof. Sanjay Pawar about...\""
            ),
            "agentUsed": "email_agent",
            "suggestedActions": [
                "Send to my group",
                "Send to all students in my department",
                "Send to faculty",
            ],
        }

    # Build LLM prompt
    user_prompt = f"""Draft an email based on this request:
"{message}"

Sender context:
- Name: {sender_name}
- Role/Designation: {role_label}

Recipient scope: {recipient_scope}
{scope_info}

Number of recipients: {len(recipients)}

CRITICAL RULES:
1. Sign off as exactly "{sender_name}" — never use "Faculty Member", "Admin Faculty", or any other placeholder.
2. The sign-off should be:
   Best regards,
   {sender_name}
   {role_label}"""

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
        "recipientNames": recipient_names,
        "subject": subject,
        "recipientScope": recipient_scope,
        "userName": sender_name,
    }

    if recipients:
        action_buttons.append({"label": "Send Email", "action": "SEND_EMAIL", "style": "primary"})
    action_buttons.append({"label": "Edit", "action": "EDIT", "style": "ghost"})
    action_buttons.append({"label": "Regenerate", "action": "REGENERATE", "style": "ghost"})

    return {
        "response": draft,
        "agentUsed": "email_agent",
        "suggestedActions": [
            "Send to all students in my department",
            "Send to my group",
            "Send to all faculty",
        ],
        "actionButtons": action_buttons,
        "actionContext": action_context,
    }


# ═══════════════════════════════════════════════════════
# Scope Detection
# ═══════════════════════════════════════════════════════

def _detect_scope(message: str, context: dict, role: str) -> str:
    """
    Detect recipient scope from message content and user role.
    Priority order:
      0. GROUP_GUIDE   — "email to guide of group X"
      1. GUIDE_GROUPS  — "email groups under guide Y"
      2. SPECIFIC_PERSON — "email to Sanjay Pawar"
      3. GROUP — specific group name pattern (ENTC-FIN-B-G1)
      4. Keywords — faculty, all students, year, department
      5. Context / role defaults
    """
    msg = message.lower()

    # Priority 0: Guide of a specific group
    if _detect_guide_of_group(message):
        return "GROUP_GUIDE"

    # Priority 1: Groups under a specific guide name
    if _detect_guide_groups(message):
        return "GUIDE_GROUPS"

    # Priority 2: Specific person name
    if _extract_target_person(message):
        return "SPECIFIC_PERSON"

    # Priority 3: Specific group name pattern
    if _extract_group_name(message):
        return "GROUP"

    # Priority 4: Explicit scope keywords
    if "faculty" in msg or "teacher" in msg or "professor" in msg:
        return "FACULTY"
    if "all students" in msg and ("department" in msg or "dept" in msg):
        return "ALL_DEPT_STUDENTS"
    if "all students" in msg or "present students" in msg or "every student" in msg:
        if role == "HOD":
            return "ALL_DEPT_STUDENTS"
        if role == "COORDINATOR":
            return "YEAR_STUDENTS"
        if role == "ADMIN":
            return "ALL_DEPT_STUDENTS"
        return "ALL_GROUPS"
    if ("year" in msg or "batch" in msg) and ("student" in msg or "send" in msg):
        return "YEAR_STUDENTS"
    if "department" in msg or "dept" in msg:
        return "ALL_DEPT_STUDENTS"

    # Priority 5: Context-based
    if context.get("groupId") or "group" in msg or "team" in msg:
        return "GROUP"

    # Default based on role
    if role == "GUIDE":
        return "ALL_GROUPS"
    if role == "COORDINATOR":
        return "YEAR_STUDENTS"
    if role == "HOD":
        return "ALL_DEPT_STUDENTS"
    if role == "ADMIN":
        return "ALL_DEPT_STUDENTS"

    return "GROUP"


# ═══════════════════════════════════════════════════════
# Helper Extractors
# ═══════════════════════════════════════════════════════

# Group name regex used across multiple functions
_GROUP_NAME_RE = re.compile(
    r'\b([A-Z]{2,4}-(?:FY|SY|TY|FIN|FINAL)-[A-Z]-G\d+)\b', re.IGNORECASE
)

# Words that should NEVER be interpreted as a person name
_SCOPE_WORDS = {
    'faculty', 'faculties', 'teacher', 'teachers', 'professor', 'professors',
    'student', 'students', 'all', 'every', 'everyone', 'department', 'dept',
    'group', 'groups', 'team', 'teams', 'batch', 'class', 'section',
    'division', 'ty', 'sy', 'fy', 'final', 'year', 'guide', 'coordinator',
    'hod', 'admin', 'member', 'members',
    # Pronouns, articles, demonstratives
    'this', 'that', 'these', 'those', 'my', 'our', 'their', 'your', 'the',
    'his', 'her', 'its', 'a', 'an', 'any', 'each', 'some',
    # Common filler words that can appear in "email to ... about" patterns
    'email', 'mail', 'write', 'send', 'draft', 'regarding', 'about',
}


def _detect_guide_of_group(message: str) -> str:
    """
    Detect patterns like:
      "email to guide of group ENTC-FIN-B-G1"
      "write to mentor of CSE-TY-A-G2"
      "ENTC-FIN-B-G1's guide"
    Returns the group name (uppercased) or empty string.
    """
    patterns = [
        r'(?:to|for)\s+(?:the\s+)?(?:guide|mentor|faculty)\s+(?:of|for|assigned\s+to)\s+(?:group\s+)?'
        + _GROUP_NAME_RE.pattern.strip(r'\b'),
        r'(?:guide|mentor)\s+(?:of|for)\s+(?:group\s+)?'
        + _GROUP_NAME_RE.pattern.strip(r'\b'),
        _GROUP_NAME_RE.pattern.strip(r'\b')
        + r"(?:'s?\s+)?(?:guide|mentor)",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            # Find the group name capturing group
            for g in match.groups():
                if g and re.match(r'[A-Z]{2,4}-(?:FY|SY|TY|FIN|FINAL)-[A-Z]-G\d+', g, re.IGNORECASE):
                    return g.upper()
    return ""


def _detect_guide_groups(message: str) -> str:
    """
    Detect patterns like:
      "email groups under guide Sanjay Pawar"
      "email Sanjay Pawar sir's groups"
      "send to students of guide Prof. Kumar"
    Returns the guide's name (title-cased) or empty string.
    """
    patterns = [
        r'groups?\s+(?:under|of|assigned\s+to|guided\s+by|belonging\s+to)\s+'
        r'(?:guide\s+)?(?:(?:dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+)?'
        r'([A-Za-z]+(?:\s+[A-Za-z]+){0,2})',
        r'(?:guide|mentor)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})'
        r"(?:'s?\s+)(?:groups?|students?|team)",
        r'(?:(?:dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+)?'
        r'([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\s+'
        r"(?:sir|ma'?am|madam|mam)(?:'s?\s+)?(?:groups?|students?|team)",
        r'students?\s+(?:under|of|guided\s+by)\s+'
        r'(?:guide\s+)?(?:(?:dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+)?'
        r'([A-Za-z]+(?:\s+[A-Za-z]+){0,2})',
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            if any(w in _SCOPE_WORDS for w in name.lower().split()):
                continue
            return name.title()
    return ""


def _extract_target_person(message: str) -> str:
    """
    Extract a specific person's name from patterns like:
      "write email to Sanjay Pawar sir about ..."
      "email to Dr. Someone about ..."
      "send mail to Ramesh Kumar ..."
    Returns the person's name (title-cased) or empty string.
    Does NOT match generic scope words like 'faculty', 'students', 'all', etc.
    """
    pattern = (
        r'(?:email|write|send|mail)\s+(?:an?\s+)?(?:email\s+)?to\s+'
        r'(?:(?:dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+)?'
        r'([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+){0,2})\s+'
        r"(?:sir|ma'?am|madam|mam)?\s*"
        r'(?:about|regarding|for|to|that|asking|and|$)'
    )
    match = re.search(pattern, message, re.IGNORECASE)
    if match:
        captured = match.group(1).strip()
        # Reject if ANY word is a generic scope keyword
        if any(w in _SCOPE_WORDS for w in captured.lower().split()):
            return ""
        return captured.title()
    return ""


def _extract_group_name(message: str) -> str:
    """Extract a specific group name like CSE-TY-A-G1, ENTC-FIN-B-G1 etc. from message."""
    match = _GROUP_NAME_RE.search(message)
    return match.group(1).upper() if match else ""


def _extract_year(message: str) -> str:
    """Try to extract academic year from message text."""
    msg = message.lower()
    if "final" in msg or "final year" in msg or "be" in msg:
        return "FINAL"
    if "third year" in msg or "ty" in msg or "3rd" in msg:
        return "TY"
    if "second year" in msg or "sy" in msg or "2nd" in msg:
        return "SY"
    if "first year" in msg or "fy" in msg or "1st" in msg:
        return "FY"
    return ""


# ═══════════════════════════════════════════════════════
# Recipient Fetching
# ═══════════════════════════════════════════════════════

async def _fetch_recipients(
    scope: str, message: str, context: dict, token: str, role: str
) -> tuple[list[str], list[str], str]:
    """
    Fetch recipient emails and names based on scope.
    Returns: (emails_list, names_list, scope_info_text)
    """
    recipients: list[str] = []
    names: list[str] = []
    scope_info = ""

    # ── GROUP_GUIDE ─────────────────────────────────────
    if scope == "GROUP_GUIDE":
        target_group = _detect_guide_of_group(message) or _extract_group_name(message)
        if target_group:
            groups_result = await db_tools.get_my_groups(token)
            matched_group = None
            if groups_result["success"]:
                for g in groups_result["data"]:
                    if g.get("name", "").upper() == target_group:
                        matched_group = g
                        break
            if matched_group:
                result = await db_tools.get_group_members_with_emails(
                    matched_group["id"], token
                )
                if result["success"] and result.get("guideEmail"):
                    recipients.append(result["guideEmail"])
                    names.append(result.get("guideName", "Guide"))
                    scope_info = f"Guide of {result['groupName']}: {result['guideName']}"
                elif result["success"]:
                    scope_info = f"⚠ Group {target_group} does not have an assigned guide."
            else:
                scope_info = (
                    f"⚠ Group {target_group} is not in your scope as {role}. "
                    "You can only email groups assigned to you."
                )

    # ── GUIDE_GROUPS ────────────────────────────────────
    elif scope == "GUIDE_GROUPS":
        target_guide = _detect_guide_groups(message)
        if target_guide:
            groups_result = await db_tools.get_my_groups(token)
            if groups_result["success"]:
                matching_groups = []
                for g in groups_result["data"]:
                    guide = g.get("guide") or {}
                    guide_name = guide.get("name", "")
                    if target_guide.lower() in guide_name.lower():
                        matching_groups.append(g)
                if matching_groups:
                    seen: set[str] = set()
                    group_names = []
                    for g in matching_groups:
                        gid = g.get("id", "")
                        group_names.append(g.get("name", ""))
                        result = await db_tools.get_group_members_with_emails(gid, token)
                        if result["success"]:
                            for m in result["members"]:
                                email = m.get("email", "")
                                if email and email not in seen:
                                    seen.add(email)
                                    recipients.append(email)
                                    names.append(m.get("name", ""))
                    scope_info = (
                        f"Groups under guide {target_guide}: {', '.join(group_names)}"
                        f" ({len(recipients)} students)"
                    )
                else:
                    scope_info = (
                        f"⚠ No groups found under guide '{target_guide}' in your scope."
                    )
        else:
            scope_info = "⚠ Could not identify the guide name from your message."

    # ── SPECIFIC_PERSON ─────────────────────────────────
    elif scope == "SPECIFIC_PERSON":
        target_name = _extract_target_person(message)
        if target_name:
            target_lower = target_name.lower()
            dept_id = context.get("departmentId", "")
            # Search faculty first
            if dept_id:
                result = await db_tools.get_faculty(dept_id, token)
                if result.get("success"):
                    for f in result.get("data", []):
                        if target_lower in f.get("name", "").lower():
                            email = f.get("email", "")
                            if email:
                                recipients.append(email)
                                names.append(f.get("name", ""))
            # If not found in faculty, search students
            if not recipients and dept_id:
                result = await db_tools.get_department_students_emails(dept_id, "", token)
                if result.get("success"):
                    for s in result.get("students", []):
                        if target_lower in s.get("name", "").lower():
                            email = s.get("email", "")
                            if email:
                                recipients.append(email)
                                names.append(s.get("name", ""))
            if recipients:
                scope_info = f"Specific person: {target_name} ({len(recipients)} found)"
            else:
                scope_info = f"⚠ Person '{target_name}' not found in your department."

    # ── GROUP ───────────────────────────────────────────
    elif scope == "GROUP":
        # Try specific group by ID from context
        group_id = context.get("groupId", "")
        if group_id:
            result = await db_tools.get_group_members_with_emails(group_id, token)
            if result["success"]:
                for m in result["members"]:
                    if m.get("email"):
                        recipients.append(m["email"])
                        names.append(m.get("name", ""))
                scope_info = f"Group: {result['groupName']} ({len(recipients)} members)"
        if not recipients:
            # Try to find group by name mentioned in message
            target_name = _extract_group_name(message)
            groups_result = await db_tools.get_my_groups(token)
            if groups_result["success"] and groups_result["data"]:
                matched_group = None
                if target_name:
                    for g in groups_result["data"]:
                        if g.get("name", "").upper() == target_name:
                            matched_group = g
                            break
                # Only fall back to first group when NO specific name was mentioned
                if not matched_group and not target_name:
                    matched_group = groups_result["data"][0]
                if matched_group:
                    gid = matched_group.get("id", "")
                    result = await db_tools.get_group_members_with_emails(gid, token)
                    if result["success"]:
                        for m in result["members"]:
                            if m.get("email"):
                                recipients.append(m["email"])
                                names.append(m.get("name", ""))
                        scope_info = f"Group: {result['groupName']} ({len(recipients)} members)"
                elif target_name:
                    scope_info = (
                        f"⚠ Group {target_name} is not in your scope as {role}. "
                        "You can only email groups assigned to you."
                    )

    # ── ALL_GROUPS ──────────────────────────────────────
    elif scope == "ALL_GROUPS":
        groups_result = await db_tools.get_my_groups(token)
        if groups_result["success"] and groups_result["data"]:
            seen: set[str] = set()
            group_names = []
            for g in groups_result["data"]:
                gid = g.get("id", "")
                if not gid:
                    continue
                group_names.append(g.get("name", ""))
                result = await db_tools.get_group_members_with_emails(gid, token)
                if result["success"]:
                    for m in result["members"]:
                        email = m.get("email", "")
                        if email and email not in seen:
                            seen.add(email)
                            recipients.append(email)
                            names.append(m.get("name", ""))
            scope_info = (
                f"All assigned groups: {', '.join(group_names[:5])}"
                f"{' ...' if len(group_names) > 5 else ''}"
                f" ({len(recipients)} students total)"
            )

    # ── ALL_DEPT_STUDENTS ───────────────────────────────
    elif scope in ("ALL_DEPT_STUDENTS", "DEPARTMENT_STUDENTS"):
        dept_id = context.get("departmentId", "")
        if dept_id:
            result = await db_tools.get_department_students_emails(dept_id, "", token)
            if result["success"]:
                for s in result["students"]:
                    if s.get("email"):
                        recipients.append(s["email"])
                        names.append(s.get("name", ""))
                scope_info = f"All students in department ({len(recipients)} students)"
        elif role == "ADMIN":
            depts_result = await db_tools.get_all_departments(token)
            if depts_result.get("success"):
                seen: set[str] = set()
                for dept in depts_result.get("data", [])[:10]:
                    did = dept.get("id", "")
                    if not did:
                        continue
                    result = await db_tools.get_department_students_emails(did, "", token)
                    if result["success"]:
                        for s in result["students"]:
                            email = s.get("email", "")
                            if email and email not in seen:
                                seen.add(email)
                                recipients.append(email)
                                names.append(s.get("name", ""))
                scope_info = f"All students across all departments ({len(recipients)} students)"

    # ── YEAR_STUDENTS ───────────────────────────────────
    elif scope == "YEAR_STUDENTS":
        dept_id = context.get("departmentId", "")
        year = context.get("year", "")
        if not year:
            year = _extract_year(message)
        if dept_id:
            result = await db_tools.get_department_students_emails(dept_id, year, token)
            if result["success"]:
                for s in result["students"]:
                    if s.get("email"):
                        recipients.append(s["email"])
                        names.append(s.get("name", ""))
                year_label = year if year else "all years"
                scope_info = f"Students in department ({year_label}, {len(recipients)} students)"

    # ── FACULTY ─────────────────────────────────────────
    elif scope == "FACULTY":
        dept_id = context.get("departmentId", "")
        if dept_id:
            result = await db_tools.get_faculty(dept_id, token)
            if result.get("success") and result.get("data"):
                for f in result.get("data", []):
                    email = f.get("email", "")
                    if email:
                        recipients.append(email)
                        names.append(f.get("name", ""))
                scope_info = f"Faculty in department ({len(recipients)} faculty members)"
            else:
                # Fallback for roles without faculty list access (e.g. GUIDE)
                dept_result = await db_tools.get_department_detail(dept_id, token)
                if dept_result.get("success"):
                    dept_data = dept_result.get("data", {})
                    seen: set[str] = set()
                    for key in ("hod", "coordinators", "guides"):
                        entries = dept_data.get(key, [])
                        if isinstance(entries, dict):
                            entries = [entries]
                        for entry in entries:
                            email = entry.get("email", "")
                            if email and email not in seen:
                                seen.add(email)
                                recipients.append(email)
                                names.append(entry.get("name", ""))
                    scope_info = f"Faculty in department ({len(recipients)} members)"
        elif role == "ADMIN":
            depts_result = await db_tools.get_all_departments(token)
            if depts_result.get("success"):
                seen: set[str] = set()
                for dept in depts_result.get("data", [])[:10]:
                    did = dept.get("id", "")
                    if not did:
                        continue
                    result = await db_tools.get_faculty(did, token)
                    if result.get("success"):
                        for f in result.get("data", []):
                            email = f.get("email", "")
                            if email and email not in seen:
                                seen.add(email)
                                recipients.append(email)
                                names.append(f.get("name", ""))
                scope_info = f"All faculty across departments ({len(recipients)} members)"

    return recipients, names, scope_info
