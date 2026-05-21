# Google Workspace Tools
from .google_workspace import (
    get_google_credentials,
    check_gmail_connected,
    send_email,
    # Calendar
    create_calendar_event,
    create_meet_link,
    get_calendar_events,
    # Drive
    create_drive_folder,
    upload_to_drive,
    list_drive_folder,
    # Sheets
    read_sheet,
    write_sheet,
    create_spreadsheet,
    append_to_sheet,
    # Docs
    create_google_doc,
)

from .plagiarism_tools import (
    check_project_similarity,
)

# Database Tools (async functions for Node backend)
from .db_tools import (
    get_my_groups,
    search_all_groups,
    get_group_members_with_emails,
    get_department_students_emails,
    get_project_details,
    get_my_projects,
    get_all_departments,
    get_department_detail,
    get_faculty,
    post_project_review,
    # New query functions for AI agents
    get_projects_by_status,
    get_review_marks,
    get_ff180_status,
    get_guide_workload,
    get_overdue_groups,
    get_all_students_with_profiles,
    get_groups_without_projects,
    update_project_status,
    bulk_update_project_status,
)

__all__ = [
    # Google Workspace
    "get_google_credentials",
    "check_gmail_connected",
    "send_email",
    "create_calendar_event",
    "create_meet_link",
    "get_calendar_events",
    "create_drive_folder",
    "upload_to_drive",
    "list_drive_folder",
    "read_sheet",
    "write_sheet",
    "create_spreadsheet",
    "append_to_sheet",
    "create_google_doc",
    "check_project_similarity",
    # Database
    "get_my_groups",
    "search_all_groups",
    "get_group_members_with_emails",
    "get_department_students_emails",
    "get_project_details",
    "get_my_projects",
    "get_all_departments",
    "get_department_detail",
    "get_faculty",
    "post_project_review",
    "get_projects_by_status",
    "get_review_marks",
    "get_ff180_status",
    "get_guide_workload",
    "get_overdue_groups",
    "get_all_students_with_profiles",
    "get_groups_without_projects",
    "update_project_status",
    "bulk_update_project_status",
]
