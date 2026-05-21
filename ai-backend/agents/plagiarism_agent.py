import json
from langchain_core.messages import SystemMessage, HumanMessage
from .intent_classifier import AgentState
from tools import get_projects_by_status, check_project_similarity

PLAGIARISM_SYSTEM_PROMPT = """You are the Plagiarism Checker Agent for the EduTrack platform.
Your job is to identify which project the user wants to check for plagiarism.
You will be provided with a list of projects available to the user.
Match the user's request to one of the project IDs.

Return ONLY a valid JSON object with:
{
    "projectId": "the matching project id, or null if not found",
    "projectTitle": "the title of the matched project, or null"
}
Do not return any markdown formatting, just the raw JSON string."""

async def run_plagiarism_agent(state: AgentState) -> dict:
    llm = state.get("llm")
    if not llm:
        from graph.orchestrator import get_llm
        llm = get_llm()

    token = state["context"].get("token")
    if not token:
        return {
            "response": "Authentication token missing. Cannot perform plagiarism check.",
            "agentUsed": "plagiarism",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Fetch all projects the user has access to
    projects_res = await get_projects_by_status(token=token, status=None, department_id=None)
    if not projects_res.get("success"):
        return {
            "response": f"Failed to fetch projects: {projects_res.get('error')}",
            "agentUsed": "plagiarism",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    all_projects = projects_res.get("data", [])
    if not all_projects:
        return {
            "response": "No projects found in the database to check against.",
            "agentUsed": "plagiarism",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Extract simplified project list for LLM matching
    projects_for_prompt = [
        {"id": p.get("id"), "title": p.get("title"), "group": p.get("group", {}).get("name", "")}
        for p in all_projects
    ]

    # Ask LLM to identify the target project
    prompt_msg = (
        f"User message: {state['message']}\n\n"
        f"Available projects: {json.dumps(projects_for_prompt)}"
    )
    
    extract_res = await llm.ainvoke([
        SystemMessage(content=PLAGIARISM_SYSTEM_PROMPT),
        HumanMessage(content=prompt_msg),
    ])

    try:
        raw_json = extract_res.content.strip()
        if raw_json.startswith("```json"):
            raw_json = raw_json[7:-3].strip()
        parsed = json.loads(raw_json)
        target_project_id = parsed.get("projectId")
    except Exception as e:
        target_project_id = None

    if not target_project_id:
        titles = "\n".join([f"- {p['title']} (Group: {p['group']})" for p in projects_for_prompt[:5]])
        return {
            "response": f"I couldn't identify which project you want to check. Here are some recent ones:\n{titles}\n\nPlease specify the project title or group name.",
            "agentUsed": "plagiarism",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Find the target project full details
    target_project = next((p for p in all_projects if p.get("id") == target_project_id), None)
    if not target_project:
        return {
            "response": "Could not find the full details for the specified project.",
            "agentUsed": "plagiarism",
            "suggestedActions": [],
            "actionButtons": [],
            "actionContext": {},
            "isTemplate": False,
        }

    # Run Similarity Check
    similarity_result = check_project_similarity(target_project, all_projects, threshold=0.40)
    
    # Generate Markdown Report
    is_unique = similarity_result.get("isUnique", True)
    similar_projects = similarity_result.get("similarProjects", [])
    
    report = f"## 📊 Plagiarism & Similarity Report\n\n"
    report += f"**Target Project:** {target_project.get('title')}\n"
    report += f"**Group:** {target_project.get('group', {}).get('name', 'N/A')}\n\n"
    
    if is_unique:
        report += "### ✅ Result: Unique\n"
        report += "No significant similarities found with other projects in the database based on title, abstract, and domain.\n"
    else:
        report += f"### ⚠️ Result: Potential Similarities Found ({len(similar_projects)})\n\n"
        report += "The following projects share significant overlap in terminology and abstract content:\n\n"
        
        for sim in similar_projects:
            report += f"#### {sim['title']} (Similarity: {sim['similarity']}%)\n"
            report += f"- **Group:** {sim['groupName']}\n"
            report += f"- **Domain:** {sim['domain']}\n"
            report += f"- **Title Similarity:** {sim['titleSimilarity']}%\n"
            report += f"- **Abstract Similarity:** {sim['abstractSimilarity']}%\n"
            if sim['commonTerms']:
                report += f"- **Common Terms:** {', '.join(sim['commonTerms'])}\n"
            report += "\n"
            
    # Add Recommendations section
    report += "### 💡 AI Recommendations & Next Steps\n"
    if is_unique:
        report += "- **For Students:** Your project concept appears unique! Continue refining your abstract and defining your core features.\n"
        report += "- **For Guides/Reviewers:** This project has no significant overlap with existing works. Recommended to proceed with approval.\n"
    else:
        highest_sim = similar_projects[0]['similarity']
        if highest_sim >= 70:
            report += "- 🔴 **High Similarity Warning:** This project heavily overlaps with existing work.\n"
            report += "- **For Students:** You must significantly differentiate your project. Focus on entirely new features or a different domain application. Your current proposal is likely to be rejected.\n"
            report += "- **For Guides/Reviewers:** High risk of plagiarism or duplicate effort. Recommended to **Reject** or demand a major pivot.\n"
        elif highest_sim >= 40:
            report += "- 🟡 **Moderate Similarity Notice:** This project shares themes with existing work.\n"
            report += "- **For Students:** Ensure your specific implementation, tech stack, or target audience is clearly differentiated from the similar projects listed above.\n"
            report += "- **For Guides/Reviewers:** Review the common terms. If the core innovation differs, it may be acceptable. Request clarification if needed.\n"
            
    report += "\n---\n*This report uses TF-IDF and Cosine Similarity to compare text across all project data.*"

    return {
        "response": report,
        "agentUsed": "plagiarism",
        "suggestedActions": ["Check another project", "Generate PDF Report"],
        "actionButtons": [
            {"label": "Download Report", "action": "DOWNLOAD_PDF", "variant": "primary"}
        ],
        "actionContext": {
            "reportContent": report,
            "projectTitle": target_project.get("title")
        },
        "isTemplate": False,
    }
