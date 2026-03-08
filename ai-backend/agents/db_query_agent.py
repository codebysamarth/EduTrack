from langchain_core.messages import SystemMessage, HumanMessage
from tools import db_tools

SYSTEM_PROMPT = """You are a data assistant for a College Project Management platform called EduTrack.
You help faculty view and understand their groups, projects, and student data.

When given data, create a clear, well-organized natural language summary.
Use bullet points and formatting for readability.
Include counts and status breakdowns where relevant.
Be concise but complete — faculty need quick overviews, not essays.

If no data is available, say so clearly and suggest what the user might try instead."""


async def run_db_query_agent(state: dict) -> dict:
    """
    Fetch live data (groups + projects) via db_tools, summarize with LLM.
    """
    message = state.get("message", "")
    context = state.get("context", {})
    token = context.get("token", "")
    llm = state.get("llm")

    # Fetch groups and projects in parallel-ish fashion
    groups_result = await db_tools.get_my_groups(token)
    projects_result = await db_tools.get_my_projects(token)

    data_summary = _build_data_summary(groups_result, projects_result)

    user_prompt = f"""User asked: "{message}"

Here is the live data from the platform:

{data_summary}

Summarize this data clearly to answer the user's question.
If they asked about something specific (e.g. a group, project status), focus on that."""

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
        ],
        "actionButtons": action_buttons,
        "actionContext": {
            "groupCount": groups_result.get("count", 0),
            "projectCount": len(projects_result.get("data", [])),
        },
    }


def _build_data_summary(groups_result: dict, projects_result: dict) -> str:
    """Build a text summary of groups and projects for LLM context."""
    parts = []

    if groups_result["success"] and groups_result["data"]:
        parts.append(f"GROUPS ({groups_result['count']} total):")
        for i, g in enumerate(groups_result["data"][:20], 1):  # cap at 20
            name = g.get("name", f"Group {i}")
            member_count = len(g.get("members", []))
            guide = g.get("guide", {})
            guide_name = guide.get("name", "Unassigned") if guide else "Unassigned"
            parts.append(f"  {i}. {name} — {member_count} members, Guide: {guide_name}")
    else:
        error = groups_result.get("error", "")
        parts.append(f"GROUPS: No groups found. {f'Error: {error}' if error else ''}")

    parts.append("")

    if projects_result["success"] and projects_result["data"]:
        projects = projects_result["data"]
        counts = projects_result.get("statusCounts", {})
        parts.append(f"PROJECTS ({len(projects)} total):")
        if counts:
            parts.append(f"  Status breakdown: {counts}")
        for i, p in enumerate(projects[:20], 1):
            title = p.get("title", f"Project {i}")
            status = p.get("status", "UNKNOWN")
            group = p.get("group", {})
            group_name = group.get("name", "N/A") if group else "N/A"
            parts.append(f"  {i}. {title} [{status}] — Group: {group_name}")
    else:
        error = projects_result.get("error", "")
        parts.append(f"PROJECTS: No projects found. {f'Error: {error}' if error else ''}")

    return "\n".join(parts)
