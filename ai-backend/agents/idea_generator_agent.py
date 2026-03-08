"""
Idea Generator Agent — Student-only.
Builds a copyable prompt template for ChatGPT/Claude (does NOT generate ideas itself).
Extracts domain/SDG/extra from context. Returns template + action buttons.
"""


async def run_idea_generator_agent(state: dict) -> dict:
    """
    Build a structured prompt template the student can copy to ChatGPT/Claude.
    This avoids relying on local Ollama for creative generation.
    """
    message = state.get("message", "")
    context = state.get("context", {})

    domain = context.get("domain", "")
    sdg_goals = context.get("sdgGoals", [])
    extra = context.get("extra", "")

    # Extract hints from the message itself if context is sparse
    if not domain:
        domain = _extract_domain(message)
    if not sdg_goals:
        sdg_goals = _extract_sdgs(message)

    template = _build_template(domain, sdg_goals, extra, message)

    action_buttons = [
        {"label": "Copy Prompt", "action": "COPY_TEXT"},
        {"label": "Open ChatGPT", "action": "OPEN_URL"},
        {"label": "Open Claude", "action": "OPEN_URL"},
        {"label": "Regenerate", "action": "REGENERATE"},
    ]

    action_context = {
        "copyText": template,
        "urls": {
            "Open ChatGPT": "https://chat.openai.com",
            "Open Claude": "https://claude.ai",
        },
    }

    return {
        "response": (
            "Here's a ready-to-use prompt template for generating project ideas. "
            "Copy it and paste into ChatGPT or Claude for best results:\n\n"
            f"---\n\n{template}\n\n---\n\n"
            "Click **Copy Prompt** below, then open your preferred AI assistant."
        ),
        "agentUsed": "idea_generator_agent",
        "isTemplate": True,
        "suggestedActions": [
            "Copy this prompt",
            "Customize the domain",
            "Add SDG goals",
        ],
        "actionButtons": action_buttons,
        "actionContext": action_context,
    }


def _build_template(
    domain: str, sdg_goals: list, extra: str, original_message: str
) -> str:
    """Build the copyable prompt template."""
    parts = [
        "I am a final-year engineering student working on my college project.",
        "I need help brainstorming project ideas with the following constraints:\n",
    ]

    if domain:
        parts.append(f"**Domain/Technology Area:** {domain}")
    else:
        parts.append(
            "**Domain/Technology Area:** [Fill in: e.g., AI/ML, Web Development, IoT, Blockchain, etc.]"
        )

    if sdg_goals:
        parts.append(f"**UN SDG Goals to address:** {', '.join(sdg_goals)}")
    else:
        parts.append(
            "**UN SDG Goals (optional):** [e.g., Quality Education, Clean Energy, etc.]"
        )

    if extra:
        parts.append(f"**Additional requirements:** {extra}")

    parts.append(f"\n**My initial idea/interest:** {original_message}")

    parts.append(
        "\nPlease suggest 5 project ideas. For each idea, provide:\n"
        "1. **Project Title**\n"
        "2. **Problem Statement** (2-3 sentences)\n"
        "3. **Proposed Solution** (brief overview)\n"
        "4. **Tech Stack** (specific technologies)\n"
        "5. **SDG Alignment** (which goals it addresses and how)\n"
        "6. **Feasibility** (can a team of 3-4 complete this in 6 months?)\n"
        "7. **Uniqueness Factor** (what makes it stand out from existing solutions)"
    )

    return "\n".join(parts)


def _extract_domain(message: str) -> str:
    """Try to extract domain from message keywords."""
    msg = message.lower()
    domains = {
        "machine learning": "Machine Learning / AI",
        "ai": "Artificial Intelligence",
        "ml": "Machine Learning",
        "web": "Web Development",
        "mobile": "Mobile App Development",
        "iot": "Internet of Things (IoT)",
        "blockchain": "Blockchain",
        "cloud": "Cloud Computing",
        "cybersecurity": "Cybersecurity",
        "data science": "Data Science",
        "nlp": "Natural Language Processing",
        "computer vision": "Computer Vision",
        "deep learning": "Deep Learning",
    }
    for keyword, domain in domains.items():
        if keyword in msg:
            return domain
    return ""


def _extract_sdgs(message: str) -> list:
    """Try to extract SDG mentions from message."""
    msg = message.lower()
    sdg_map = {
        "poverty": "No Poverty",
        "hunger": "Zero Hunger",
        "health": "Good Health and Well-being",
        "education": "Quality Education",
        "gender": "Gender Equality",
        "water": "Clean Water and Sanitation",
        "energy": "Affordable and Clean Energy",
        "economic": "Decent Work and Economic Growth",
        "industry": "Industry, Innovation and Infrastructure",
        "inequality": "Reduced Inequalities",
        "sustainable cities": "Sustainable Cities and Communities",
        "climate": "Climate Action",
        "ocean": "Life Below Water",
        "environment": "Life on Land",
        "peace": "Peace, Justice and Strong Institutions",
    }
    found = []
    for keyword, sdg in sdg_map.items():
        if keyword in msg:
            found.append(sdg)
    return found
