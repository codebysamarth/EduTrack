"""
GOOGLE OAUTH SETUP — Do this once before running:

1. Go to https://console.cloud.google.com
2. Create a new project called "EduTrack"
3. Enable these APIs:
   - Gmail API
   - Google Calendar API (for future use)
   - Google Drive API (for future use)
   - Google Sheets API (for future use)
4. Go to APIs & Services → Credentials
5. Create OAuth 2.0 Client ID
   - Application type: Desktop App
   - Name: EduTrack Local
6. Download the JSON file
7. Rename it to client_secret.json
8. Place it in ai-backend/credentials/client_secret.json
9. Run the FastAPI server once — browser will open for Google login
10. After login, token.json is auto-created in credentials/
11. Future runs use token.json automatically (auto-refreshed)

IMPORTANT: Add credentials/ to .gitignore — never commit these files.
"""

import base64
import json
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import GOOGLE_CLIENT_SECRET_PATH, GOOGLE_TOKEN_PATH, GOOGLE_SCOPES


def get_google_credentials():
    """
    Load credentials from token.json if exists and valid.
    If expired: auto-refresh using refresh_token.
    On server (Render): loads token from GOOGLE_TOKEN_B64 env var.
    If no token.json: run OAuth flow (opens browser for first-time auth).
    Returns: google.oauth2.credentials.Credentials object
    """
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request

    # On deployed server: restore token.json from base64 env var
    token_b64 = os.getenv("GOOGLE_TOKEN_B64")
    if token_b64 and not os.path.exists(GOOGLE_TOKEN_PATH):
        os.makedirs(os.path.dirname(GOOGLE_TOKEN_PATH), exist_ok=True)
        with open(GOOGLE_TOKEN_PATH, "wb") as f:
            f.write(base64.b64decode(token_b64))

    creds = None

    if os.path.exists(GOOGLE_TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(GOOGLE_TOKEN_PATH, GOOGLE_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(GOOGLE_CLIENT_SECRET_PATH):
                raise FileNotFoundError(
                    "client_secret.json not found in credentials/. "
                    "See setup instructions at top of google_workspace.py"
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                GOOGLE_CLIENT_SECRET_PATH, GOOGLE_SCOPES
            )
            # Fixed port so Google Console redirect URI can match:
            # http://localhost:8090/
            creds = flow.run_local_server(port=8090)

        with open(GOOGLE_TOKEN_PATH, "w") as token:
            token.write(creds.to_json())

    return creds


def check_gmail_connected() -> bool:
    """Check if Gmail OAuth is set up. Used in /health endpoint."""
    try:
        creds = get_google_credentials()
        return creds is not None and creds.valid
    except Exception:
        return False


def send_email(
    to_emails: list[str],
    subject: str,
    body: str,
    sender_name: str = "EduTrack Platform",
) -> dict:
    """
    Send real email via Gmail API to multiple recipients.

    Returns:
        { success: bool, messageId: str, sentTo: list[str], error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("gmail", "v1", credentials=creds)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["To"] = ", ".join(to_emails)
        msg["From"] = sender_name

        text_part = MIMEText(body, "plain")
        msg.attach(text_part)

        html_body = body.replace("\n", "<br>")
        html_content = (
            '<html><body style="font-family: Arial, sans-serif; max-width: 600px; '
            'margin: 0 auto; padding: 20px;">'
            '<div style="border-left: 4px solid #F5A623; padding-left: 16px;">'
            f"{html_body}"
            "</div>"
            '<hr style="margin-top: 30px; border: 1px solid #eee;">'
            '<p style="color: #999; font-size: 12px;">'
            "Sent via EduTrack College Project Platform"
            "</p>"
            "</body></html>"
        )
        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        result = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw})
            .execute()
        )

        return {
            "success": True,
            "messageId": result.get("id"),
            "sentTo": to_emails,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "messageId": None,
            "sentTo": [],
            "error": str(e),
        }


# ─── Future stubs ────────────────────────────────────────


def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str,
    attendee_emails: list[str],
    description: str = "",
) -> dict:
    """TODO: Implement when Calendar agent is added."""
    return {"success": False, "error": "Calendar integration coming soon"}


def upload_to_drive(
    file_path: str,
    folder_id: str = None,
    file_name: str = None,
) -> dict:
    """TODO: Implement when Drive agent is added."""
    return {"success": False, "error": "Drive integration coming soon"}


def read_sheet(spreadsheet_id: str, range_name: str) -> dict:
    """TODO: Implement when Sheets agent is added."""
    return {"success": False, "error": "Sheets integration coming soon"}
