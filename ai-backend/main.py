import os
import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import OPENAI_MODEL, OLLAMA_MODEL, GEMINI_MODEL, LLM_PROVIDER, PORT
from schemas import ChatRequest, ChatResponse, ActionRequest, ActionResponse, HealthResponse
from graph.orchestrator import compiled_graph, get_llm
from tools.google_workspace import check_gmail_connected, send_email, create_calendar_event
from tools.db_tools import post_project_review

app = FastAPI(title="EduTrack AI Backend", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),  # deployed frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ──────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check LLM connectivity + Gmail OAuth status."""
    llm_ok = False
    try:
        llm = get_llm()
        from langchain_core.messages import HumanMessage
        resp = await llm.ainvoke([HumanMessage(content="ping")])
        llm_ok = bool(resp.content)
    except Exception:
        pass

    gmail_ok = check_gmail_connected()

    model_name = (
        GEMINI_MODEL if LLM_PROVIDER == "gemini"
        else OLLAMA_MODEL if LLM_PROVIDER == "ollama"
        else OPENAI_MODEL
    )
    status = "healthy" if llm_ok else "degraded"
    message = "All systems operational" if (llm_ok and gmail_ok) else (
        f"LLM ({LLM_PROVIDER}) not reachable" if not llm_ok else "Gmail not connected"
    )

    return HealthResponse(
        status=status,
        model=model_name,
        openaiConnected=llm_ok,
        gmailConnected=gmail_ok,
        message=message,
    )


# ─── Chat ────────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request):
    """Run the LangGraph orchestrator for a user message."""
    # Extract bearer token from the forwarded request
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""

    context = dict(req.context)
    context["token"] = token
    context["role"] = req.userRole

    initial_state = {
        "message": req.message,
        "userRole": req.userRole,
        "context": context,
        "intent": "",
        "response": "",
        "agentUsed": "",
        "suggestedActions": [],
        "isTemplate": False,
        "actionButtons": [],
        "actionContext": {},
        "llm": None,
    }

    result = await compiled_graph.ainvoke(initial_state)

    return ChatResponse(
        response=result.get("response", "I'm sorry, I couldn't process that."),
        agentUsed=result.get("agentUsed", "general"),
        suggestedActions=result.get("suggestedActions", []),
        isTemplate=result.get("isTemplate", False),
        actionButtons=result.get("actionButtons", []),
        actionContext=result.get("actionContext", {}),
    )


# ─── Actions ─────────────────────────────────────────────────────────────

@app.post("/api/action", response_model=ActionResponse)
async def execute_action(req: ActionRequest, request: Request):
    """Execute a confirmed action (send email, post review, etc.)."""
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""

    context = dict(req.context)

    if req.actionType == "SEND_EMAIL":
        recipients = context.get("recipients", [])
        subject = context.get("subject", "EduTrack Notification")
        body = req.draftContent
        sender_name = context.get("userName", "EduTrack Platform")

        if not recipients:
            return ActionResponse(
                success=False,
                message="No recipients found. Please draft the email again.",
            )

        result = send_email(recipients, subject, body, sender_name)
        return ActionResponse(
            success=result["success"],
            message=(
                f"Email sent to {len(result['sentTo'])} recipients."
                if result["success"]
                else f"Failed to send email: {result['error']}"
            ),
            details=result,
        )

    elif req.actionType == "POST_REVIEW":
        project_id = context.get("projectId", "")
        is_approved = context.get("isApproved", True)
        comment = req.draftContent
        rejection_reason = context.get("rejectionReason", "")

        if not project_id:
            return ActionResponse(
                success=False,
                message="No project selected. Please start a review first.",
            )

        result = await post_project_review(
            project_id, is_approved, comment, rejection_reason, token
        )
        status_word = "approved" if is_approved else "sent back for revision"
        return ActionResponse(
            success=result["success"],
            message=(
                f"Project {status_word} successfully."
                if result["success"]
                else f"Failed to submit review: {result['error']}"
            ),
            details=result,
        )

    elif req.actionType == "CONFIRM_CALENDAR":
        title = context.get("title", "Meeting")
        start_datetime = context.get("start_datetime")
        end_datetime = context.get("end_datetime")
        emails = context.get("emails", [])
        email_draft = context.get("email_draft", "")
        add_meet_link = context.get("add_meet_link", True)

        if not start_datetime or not emails:
            return ActionResponse(
                success=False,
                message="Missing required calendar details (date, time, or emails).",
            )

        # 1. Create Calendar Event
        cal_result = create_calendar_event(
            title=title,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            attendee_emails=emails,
            description=email_draft,
            add_meet_link=add_meet_link
        )

        if not cal_result.get("success"):
            return ActionResponse(
                success=False,
                message=f"Failed to create calendar event: {cal_result.get('error')}",
            )

        meet_link = cal_result.get("meetLink")
        meet_text = f"\nGoogle Meet Link: {meet_link}" if meet_link else ""
        
        # 2. Send Emails
        body = f"{email_draft}\n{meet_text}"
        sender_name = context.get("userName", "EduTrack Platform")
        
        send_result = send_email(emails, title, body, sender_name)
        
        if send_result.get("success"):
            return ActionResponse(
                success=True,
                message=f"Calendar event created and invites sent to {len(emails)} participants!",
            )
        else:
            return ActionResponse(
                success=True,
                message=f"Event created (Meet: {'Yes' if meet_link else 'No'}), but failed to send some emails: {send_result.get('error')}",
            )

    elif req.actionType == "REGENERATE":
        return ActionResponse(
            success=True,
            message="Please send the chat message again to regenerate.",
        )

    return ActionResponse(
        success=False,
        message=f"Unknown action type: {req.actionType}",
    )


# ─── Root ────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "EduTrack AI Backend running", "docs": "/docs"}


# ─── Entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)