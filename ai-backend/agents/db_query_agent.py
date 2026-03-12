from langchain_core.messages import SystemMessage, HumanMessage
from tools import db_tools

SYSTEM_PROMPT = """You are a data assistant for a College Project Management platform called EduTrack.
You help faculty and admins view and understand their departments, faculty, groups, projects, and student data.

Platform hierarchy:
- ADMIN: Can see everything across all departments
- HOD: Manages one department — sees all groups, projects, faculty, students in their department
- COORDINATOR: Manages all groups in their department, can review/approve/reject projects, publish to showcase, create/edit groups, approve student-formed groups
- GUIDE: Sees only groups/projects assigned to them

Project statuses: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → COMPLETED → PUBLISHED
Group statuses: FORMING → PENDING_APPROVAL → APPROVED

CRITICAL RULES:
1. ONLY use data from the "live data" section below. Do NOT invent, guess, or hallucinate any departments, faculty, groups, projects, or counts.
2. Count items by counting the numbered entries in the data — do NOT make up numbers.
3. If a department, person, or project is NOT in the provided data, say it was not found.
4. Use the EXACT names, codes, and counts from the data. Never approximate or paraphrase names.
5. Always specify counts from the data — e.g. "4 departments" only if exactly 4 are listed.

When given data, create a clear, well-organized natural language summary.
Use bullet points and formatting for readability.
Be concise but complete — faculty need quick overviews, not essays."""


async def run_db_query_agent(state: dict) -> dict:
    """
    Fetch live data (departments + groups + projects + faculty) via db_tools,
    summarize with LLM. Fetches more data for higher-privilege roles.
    """
    message = state.get("message", "")
    context = state.get("context", {})
    token = context.get("token", "")
    role = context.get("role", "")
    llm = state.get("llm")

    # Always fetch groups and projects
    groups_result = await db_tools.get_my_groups(token)
    projects_result = await db_tools.get_my_projects(token)

    # Fetch departments (public endpoint — works for all roles)
    depts_result = await db_tools.get_all_departments(token)

    # For ADMIN/HOD/COORDINATOR — also fetch faculty
    faculty_result = {"success": False, "data": [], "count": 0, "error": None}
    if role in ("ADMIN", "HOD", "COORDINATOR"):
        dept_id = _extract_dept_id(context, depts_result)
        if dept_id:
            faculty_result = await db_tools.get_faculty(dept_id, token)
        elif role == "ADMIN" and depts_result.get("success"):
            # ADMIN: fetch faculty from all departments and combine
            all_faculty = []
            for dept in depts_result.get("data", [])[:10]:
                did = dept.get("id", "")
                if did:
                    res = await db_tools.get_faculty(did, token)
                    if res.get("success"):
                        for f in res.get("data", []):
                            f["department"] = dept.get("name", "")
                        all_faculty.extend(res.get("data", []))
            if all_faculty:
                faculty_result = {
                    "success": True,
                    "data": all_faculty,
                    "count": len(all_faculty),
                    "error": None,
                }

    data_summary = _build_data_summary(
        groups_result, projects_result, depts_result, faculty_result, role
    )

    user_prompt = f"""User role: {role}
User asked: "{message}"

Here is the LIVE DATA from the platform (this is the ONLY source of truth — do not add anything):

{data_summary}

Answer the user's question using ONLY the data above.
- Count items by counting the numbered list entries — do NOT guess.
- Use exact names from the data. Do not shorten or alter names.
- If the data doesn't contain what the user asked about, say that specific data was not found."""

    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])

    action_buttons = [
        {"label": "Export Data", "action": "EXPORT"},
        {"label": "Refresh", "action": "REGENERATE"},
    ]

    return {
        "response": response.content.strip(),
        "agentUsed": "db_query_agent",
        "suggestedActions": [
            "Show project details",
            "Show group members",
            "Check project statuses",
            "List faculty",
            "Show department info",
        ],
        "actionButtons": action_buttons,
        "actionContext": {
            "groupCount": groups_result.get("count", 0),
            "projectCount": len(projects_result.get("data", [])),
        },
    }


def _extract_dept_id(context: dict, depts_result: dict) -> str:
    """Try to extract departmentId from context or user profile."""
    dept_id = context.get("departmentId", "")
    if dept_id:
        return dept_id
    # Try from user context
    faculty_profile = context.get("facultyProfile", {})
    if faculty_profile and faculty_profile.get("departmentId"):
        return faculty_profile["departmentId"]
    # If only one department exists, use it
    if depts_result.get("success") and len(depts_result.get("data", [])) == 1:
        return depts_result["data"][0].get("id", "")
    return ""


def _build_data_summary(
    groups_result: dict,
    projects_result: dict,
    depts_result: dict,
    faculty_result: dict,
    role: str,
) -> str:
    """Build a comprehensive text summary of all data for LLM context."""
    parts = []

    # ── Departments ──
    if depts_result.get("success") and depts_result.get("data"):
        parts.append(f"DEPARTMENTS ({depts_result['count']} total):")
        for i, d in enumerate(depts_result["data"][:20], 1):
            name = d.get("name", f"Dept {i}")
            code = d.get("code", "")
            hod = d.get("hod")
            hod_name = hod.get("name", "Not assigned") if hod else "Not assigned"
            counts = d.get("_count", {})
            group_count = counts.get("groups", 0)
            student_count = counts.get("studentProfiles", 0)
            parts.append(
                f"  {i}. {name} ({code}) — HOD: {hod_name}, "
                f"{group_count} groups, {student_count} students"
            )
        parts.append("")

    # ── Faculty ──
    if faculty_result.get("success") and faculty_result.get("data"):
        parts.append(f"FACULTY ({faculty_result['count']} total):")
        for i, f in enumerate(faculty_result["data"][:30], 1):
            name = f.get("name", f"Faculty {i}")
            designation = f.get("designation", "")
            roles = f.get("roles", [])
            email = f.get("email", "")
            approved = f.get("isApproved", False)
            dept_name = f.get("department", "")
            role_str = ", ".join(roles) if roles else "No roles"
            parts.append(
                f"  {i}. {name} ({designation}) — Roles: {role_str}, "
                f"Email: {email}, Approved: {approved}"
                f"{f', Dept: {dept_name}' if dept_name else ''}"
            )
        parts.append("")

    # ── Groups ──
    if groups_result.get("success") and groups_result.get("data"):
        parts.append(f"GROUPS ({groups_result['count']} total):")
        for i, g in enumerate(groups_result["data"][:20], 1):
            name = g.get("name", f"Group {i}")
            member_count = g.get("membersCount", len(g.get("members", [])))
            guide = g.get("guide", {})
            guide_name = guide.get("name", "Unassigned") if guide else "Unassigned"
            status = g.get("status", "")
            year = g.get("year", "")
            division = g.get("division", "")
            dept = g.get("department", {})
            dept_name = dept.get("name", "") if dept else ""
            project = g.get("project")
            project_info = ""
            if project:
                project_info = f", Project: {project.get('title', 'Untitled')} [{project.get('status', '')}]"
            parts.append(
                f"  {i}. {name} — {member_count} members, Guide: {guide_name}, "
                f"Status: {status}, Year: {year}/{division}"
                f"{f', Dept: {dept_name}' if dept_name else ''}{project_info}"
            )
    else:
        error = groups_result.get("error", "")
        parts.append(f"GROUPS: No groups found. {f'Error: {error}' if error else ''}")

    parts.append("")

    # ── Projects ──
    if projects_result.get("success") and projects_result.get("data"):
        projects = projects_result["data"]
        counts = projects_result.get("statusCounts", {})
        parts.append(f"PROJECTS ({len(projects)} total):")
        if counts:
            parts.append(f"  Status breakdown: {counts}")
        for i, p in enumerate(projects[:20], 1):
            title = p.get("title", f"Project {i}")
            status = p.get("status", "UNKNOWN")
            domain = p.get("domain", "")
            group = p.get("group", {})
            group_name = group.get("name", "N/A") if group else "N/A"
            guide = p.get("guide", {})
            guide_name = guide.get("name", "") if guide else ""
            dept = p.get("department", {})
            dept_code = dept.get("code", "") if dept else ""
            published = p.get("isPublished", False)
            parts.append(
                f"  {i}. {title} [{status}] — Group: {group_name}"
                f"{f', Guide: {guide_name}' if guide_name else ''}"
                f"{f', Domain: {domain}' if domain else ''}"
                f"{f', Dept: {dept_code}' if dept_code else ''}"
                f"{', Published' if published else ''}"
            )
    else:
        error = projects_result.get("error", "")
        parts.append(f"PROJECTS: No projects found. {f'Error: {error}' if error else ''}")

    return "\n".join(parts)
