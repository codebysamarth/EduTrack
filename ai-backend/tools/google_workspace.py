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


# ─── Google Calendar API ────────────────────────────────────


def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str,
    attendee_emails: list[str],
    description: str = "",
    add_meet_link: bool = True,
    timezone: str = "Asia/Kolkata",
) -> dict:
    """
    Create a Google Calendar event with optional Google Meet link.

    Args:
        title: Event title
        start_datetime: ISO format datetime string (e.g. "2024-03-20T10:00:00")
        end_datetime: ISO format datetime string
        attendee_emails: List of attendee email addresses
        description: Event description
        add_meet_link: Whether to add a Google Meet video conference link
        timezone: Timezone for the event (default: Asia/Kolkata)

    Returns:
        { success: bool, eventId: str, meetLink: str, htmlLink: str, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("calendar", "v3", credentials=creds)

        event = {
            "summary": title,
            "description": description,
            "start": {
                "dateTime": start_datetime,
                "timeZone": timezone,
            },
            "end": {
                "dateTime": end_datetime,
                "timeZone": timezone,
            },
            "attendees": [{"email": email} for email in attendee_emails],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},  # 1 day before
                    {"method": "popup", "minutes": 30},       # 30 min before
                ],
            },
        }

        # Add Google Meet conference if requested
        if add_meet_link:
            event["conferenceData"] = {
                "createRequest": {
                    "requestId": f"edutrack-{title[:20].replace(' ', '-').lower()}-{start_datetime[:10]}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }

        created_event = service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1 if add_meet_link else 0,
            sendUpdates="all",  # Send email invites to attendees
        ).execute()

        meet_link = None
        if add_meet_link and created_event.get("conferenceData"):
            entry_points = created_event["conferenceData"].get("entryPoints", [])
            for ep in entry_points:
                if ep.get("entryPointType") == "video":
                    meet_link = ep.get("uri")
                    break

        return {
            "success": True,
            "eventId": created_event.get("id"),
            "meetLink": meet_link,
            "htmlLink": created_event.get("htmlLink"),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "eventId": None,
            "meetLink": None,
            "htmlLink": None,
            "error": str(e),
        }


def create_meet_link(
    title: str,
    start_datetime: str,
    duration_minutes: int = 60,
    attendee_emails: list[str] = None,
) -> dict:
    """
    Convenience function to create just a Google Meet link via Calendar event.

    Args:
        title: Meeting title
        start_datetime: ISO format datetime string
        duration_minutes: Meeting duration in minutes
        attendee_emails: Optional list of attendees

    Returns:
        { success: bool, meetLink: str, eventId: str, error: str }
    """
    from datetime import datetime, timedelta

    try:
        # Parse start time and calculate end time
        start = datetime.fromisoformat(start_datetime.replace("Z", "+00:00"))
        end = start + timedelta(minutes=duration_minutes)
        end_datetime = end.isoformat()

        result = create_calendar_event(
            title=title,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            attendee_emails=attendee_emails or [],
            description=f"Meeting created via EduTrack Platform",
            add_meet_link=True,
        )

        return {
            "success": result["success"],
            "meetLink": result.get("meetLink"),
            "eventId": result.get("eventId"),
            "error": result.get("error"),
        }

    except Exception as e:
        return {
            "success": False,
            "meetLink": None,
            "eventId": None,
            "error": str(e),
        }


def get_calendar_events(
    time_min: str = None,
    time_max: str = None,
    max_results: int = 50,
) -> dict:
    """
    List calendar events within a time range.

    Args:
        time_min: Start of time range (ISO format). Defaults to now.
        time_max: End of time range (ISO format). Defaults to 30 days from now.
        max_results: Maximum number of events to return.

    Returns:
        { success: bool, events: list, error: str }
    """
    from googleapiclient.discovery import build
    from datetime import datetime, timedelta

    try:
        creds = get_google_credentials()
        service = build("calendar", "v3", credentials=creds)

        if not time_min:
            time_min = datetime.utcnow().isoformat() + "Z"
        if not time_max:
            time_max = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = events_result.get("items", [])

        formatted_events = []
        for event in events:
            start = event["start"].get("dateTime", event["start"].get("date"))
            end = event["end"].get("dateTime", event["end"].get("date"))

            meet_link = None
            if event.get("conferenceData"):
                for ep in event["conferenceData"].get("entryPoints", []):
                    if ep.get("entryPointType") == "video":
                        meet_link = ep.get("uri")
                        break

            formatted_events.append({
                "id": event.get("id"),
                "title": event.get("summary", "No title"),
                "start": start,
                "end": end,
                "meetLink": meet_link,
                "attendees": [a.get("email") for a in event.get("attendees", [])],
            })

        return {
            "success": True,
            "events": formatted_events,
            "count": len(formatted_events),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "events": [],
            "count": 0,
            "error": str(e),
        }


# ─── Google Drive API ────────────────────────────────────────


def create_drive_folder(
    folder_name: str,
    parent_folder_id: str = None,
    share_with_emails: list[str] = None,
    share_role: str = "writer",
) -> dict:
    """
    Create a folder in Google Drive with optional sharing.

    Args:
        folder_name: Name of the folder to create
        parent_folder_id: Optional parent folder ID to create inside
        share_with_emails: List of emails to share the folder with
        share_role: Role for sharing ("reader", "writer", "commenter")

    Returns:
        { success: bool, folderId: str, webViewLink: str, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("drive", "v3", credentials=creds)

        file_metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_folder_id:
            file_metadata["parents"] = [parent_folder_id]

        folder = service.files().create(
            body=file_metadata,
            fields="id, webViewLink",
        ).execute()

        folder_id = folder.get("id")
        web_view_link = folder.get("webViewLink")

        # Share with specified emails
        shared_with = []
        if share_with_emails:
            for email in share_with_emails:
                try:
                    service.permissions().create(
                        fileId=folder_id,
                        body={
                            "type": "user",
                            "role": share_role,
                            "emailAddress": email,
                        },
                        sendNotificationEmail=True,
                    ).execute()
                    shared_with.append(email)
                except Exception as share_err:
                    print(f"Warning: Could not share with {email}: {share_err}")

        return {
            "success": True,
            "folderId": folder_id,
            "webViewLink": web_view_link,
            "sharedWith": shared_with,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "folderId": None,
            "webViewLink": None,
            "sharedWith": [],
            "error": str(e),
        }


def upload_to_drive(
    file_path: str = None,
    file_content: bytes = None,
    file_name: str = None,
    mime_type: str = None,
    folder_id: str = None,
    share_with_emails: list[str] = None,
) -> dict:
    """
    Upload a file to Google Drive.

    Args:
        file_path: Local path to the file (either this or file_content required)
        file_content: Raw file bytes (either this or file_path required)
        file_name: Name for the file in Drive (required if using file_content)
        mime_type: MIME type of the file (auto-detected if file_path provided)
        folder_id: Optional folder ID to upload into
        share_with_emails: List of emails to share the file with

    Returns:
        { success: bool, fileId: str, webViewLink: str, error: str }
    """
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
    import mimetypes
    import io

    try:
        creds = get_google_credentials()
        service = build("drive", "v3", credentials=creds)

        if file_path:
            if not file_name:
                file_name = os.path.basename(file_path)
            if not mime_type:
                mime_type, _ = mimetypes.guess_type(file_path)
                mime_type = mime_type or "application/octet-stream"
            media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
        elif file_content:
            if not file_name:
                return {"success": False, "error": "file_name required when using file_content"}
            if not mime_type:
                mime_type = "application/octet-stream"
            media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
        else:
            return {"success": False, "error": "Either file_path or file_content is required"}

        file_metadata = {"name": file_name}
        if folder_id:
            file_metadata["parents"] = [folder_id]

        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink",
        ).execute()

        file_id = uploaded_file.get("id")
        web_view_link = uploaded_file.get("webViewLink")

        # Share with specified emails
        if share_with_emails:
            for email in share_with_emails:
                try:
                    service.permissions().create(
                        fileId=file_id,
                        body={"type": "user", "role": "reader", "emailAddress": email},
                        sendNotificationEmail=False,
                    ).execute()
                except Exception:
                    pass

        return {
            "success": True,
            "fileId": file_id,
            "webViewLink": web_view_link,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "fileId": None,
            "webViewLink": None,
            "error": str(e),
        }


def list_drive_folder(folder_id: str = None, max_results: int = 100) -> dict:
    """
    List files and folders inside a Drive folder.

    Args:
        folder_id: ID of the folder to list. If None, lists root folder.
        max_results: Maximum number of items to return.

    Returns:
        { success: bool, files: list, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("drive", "v3", credentials=creds)

        query = f"'{folder_id}' in parents" if folder_id else "'root' in parents"
        query += " and trashed = false"

        results = service.files().list(
            q=query,
            pageSize=max_results,
            fields="files(id, name, mimeType, webViewLink, createdTime, modifiedTime)",
        ).execute()

        files = results.get("files", [])

        formatted_files = []
        for f in files:
            formatted_files.append({
                "id": f.get("id"),
                "name": f.get("name"),
                "mimeType": f.get("mimeType"),
                "webViewLink": f.get("webViewLink"),
                "isFolder": f.get("mimeType") == "application/vnd.google-apps.folder",
                "createdTime": f.get("createdTime"),
                "modifiedTime": f.get("modifiedTime"),
            })

        return {
            "success": True,
            "files": formatted_files,
            "count": len(formatted_files),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "files": [],
            "count": 0,
            "error": str(e),
        }


# ─── Google Sheets API ────────────────────────────────────────


def read_sheet(
    spreadsheet_id: str,
    range_name: str,
    value_render_option: str = "FORMATTED_VALUE",
) -> dict:
    """
    Read data from a Google Sheets spreadsheet.

    Args:
        spreadsheet_id: The ID of the spreadsheet (from the URL)
        range_name: A1 notation range (e.g., "Sheet1!A1:D10" or "A:D")
        value_render_option: How values should be rendered ("FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA")

    Returns:
        { success: bool, values: list[list], rowCount: int, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("sheets", "v4", credentials=creds)

        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueRenderOption=value_render_option,
        ).execute()

        values = result.get("values", [])

        return {
            "success": True,
            "values": values,
            "rowCount": len(values),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "values": [],
            "rowCount": 0,
            "error": str(e),
        }


def write_sheet(
    spreadsheet_id: str,
    range_name: str,
    values: list[list],
    value_input_option: str = "USER_ENTERED",
) -> dict:
    """
    Write data to a Google Sheets spreadsheet.

    Args:
        spreadsheet_id: The ID of the spreadsheet
        range_name: A1 notation range to write to (e.g., "Sheet1!A1")
        values: 2D list of values to write [[row1col1, row1col2], [row2col1, row2col2]]
        value_input_option: How input data should be interpreted ("RAW" or "USER_ENTERED")

    Returns:
        { success: bool, updatedCells: int, updatedRange: str, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("sheets", "v4", credentials=creds)

        body = {"values": values}

        result = service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption=value_input_option,
            body=body,
        ).execute()

        return {
            "success": True,
            "updatedCells": result.get("updatedCells", 0),
            "updatedRange": result.get("updatedRange", ""),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "updatedCells": 0,
            "updatedRange": "",
            "error": str(e),
        }


def create_spreadsheet(
    title: str,
    sheet_names: list[str] = None,
    share_with_emails: list[str] = None,
) -> dict:
    """
    Create a new Google Sheets spreadsheet.

    Args:
        title: Title of the spreadsheet
        sheet_names: Optional list of sheet names to create (default: ["Sheet1"])
        share_with_emails: List of emails to share with

    Returns:
        { success: bool, spreadsheetId: str, spreadsheetUrl: str, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        sheets_service = build("sheets", "v4", credentials=creds)
        drive_service = build("drive", "v3", credentials=creds)

        sheets = []
        if sheet_names:
            for name in sheet_names:
                sheets.append({"properties": {"title": name}})
        else:
            sheets.append({"properties": {"title": "Sheet1"}})

        spreadsheet = sheets_service.spreadsheets().create(
            body={
                "properties": {"title": title},
                "sheets": sheets,
            },
            fields="spreadsheetId,spreadsheetUrl",
        ).execute()

        spreadsheet_id = spreadsheet.get("spreadsheetId")
        spreadsheet_url = spreadsheet.get("spreadsheetUrl")

        # Share with specified emails
        if share_with_emails:
            for email in share_with_emails:
                try:
                    drive_service.permissions().create(
                        fileId=spreadsheet_id,
                        body={"type": "user", "role": "writer", "emailAddress": email},
                        sendNotificationEmail=True,
                    ).execute()
                except Exception:
                    pass

        return {
            "success": True,
            "spreadsheetId": spreadsheet_id,
            "spreadsheetUrl": spreadsheet_url,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "spreadsheetId": None,
            "spreadsheetUrl": None,
            "error": str(e),
        }


def append_to_sheet(
    spreadsheet_id: str,
    range_name: str,
    values: list[list],
    value_input_option: str = "USER_ENTERED",
) -> dict:
    """
    Append rows to the end of a Google Sheets range.

    Args:
        spreadsheet_id: The ID of the spreadsheet
        range_name: A1 notation range to append to (e.g., "Sheet1!A:D")
        values: 2D list of rows to append
        value_input_option: How input should be interpreted

    Returns:
        { success: bool, updatedRows: int, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        service = build("sheets", "v4", credentials=creds)

        body = {"values": values}

        result = service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption=value_input_option,
            insertDataOption="INSERT_ROWS",
            body=body,
        ).execute()

        updates = result.get("updates", {})

        return {
            "success": True,
            "updatedRows": updates.get("updatedRows", 0),
            "updatedRange": updates.get("updatedRange", ""),
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "updatedRows": 0,
            "updatedRange": "",
            "error": str(e),
        }


# ─── Google Docs API ────────────────────────────────────────


def create_google_doc(
    title: str,
    content: str = "",
    folder_id: str = None,
    share_with_emails: list[str] = None,
) -> dict:
    """
    Create a new Google Docs document.

    Args:
        title: Document title
        content: Initial text content to add to the document
        folder_id: Optional Drive folder ID to create the doc in
        share_with_emails: List of emails to share with

    Returns:
        { success: bool, documentId: str, documentUrl: str, error: str }
    """
    from googleapiclient.discovery import build

    try:
        creds = get_google_credentials()
        docs_service = build("docs", "v1", credentials=creds)
        drive_service = build("drive", "v3", credentials=creds)

        # Create the document
        doc = docs_service.documents().create(
            body={"title": title}
        ).execute()

        document_id = doc.get("documentId")

        # Add content if provided
        if content:
            docs_service.documents().batchUpdate(
                documentId=document_id,
                body={
                    "requests": [
                        {
                            "insertText": {
                                "location": {"index": 1},
                                "text": content,
                            }
                        }
                    ]
                },
            ).execute()

        # Move to folder if specified
        if folder_id:
            # Get current parents
            file = drive_service.files().get(
                fileId=document_id,
                fields="parents",
            ).execute()
            previous_parents = ",".join(file.get("parents", []))

            # Move to new folder
            drive_service.files().update(
                fileId=document_id,
                addParents=folder_id,
                removeParents=previous_parents,
                fields="id, parents",
            ).execute()

        # Share with specified emails
        if share_with_emails:
            for email in share_with_emails:
                try:
                    drive_service.permissions().create(
                        fileId=document_id,
                        body={"type": "user", "role": "writer", "emailAddress": email},
                        sendNotificationEmail=True,
                    ).execute()
                except Exception:
                    pass

        document_url = f"https://docs.google.com/document/d/{document_id}/edit"

        return {
            "success": True,
            "documentId": document_id,
            "documentUrl": document_url,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "documentId": None,
            "documentUrl": None,
            "error": str(e),
        }
