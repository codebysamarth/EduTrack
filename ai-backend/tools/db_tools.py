import httpx
from config import NODE_BACKEND_URL


def _auth_headers(token: str) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


async def get_my_groups(token: str) -> dict:
    """Fetch guide's or coordinator's groups from Node backend."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/groups",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            groups = data if isinstance(data, list) else data.get("data", data)
            return {"success": True, "data": groups, "count": len(groups), "error": None}
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def get_group_members_with_emails(group_id: str, token: str) -> dict:
    """Fetch specific group's members with their emails."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/groups/{group_id}",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            group = r.json()

            members = []
            for m in group.get("members", []):
                student = m.get("student", {})
                sp = student.get("studentProfile", {}) or {}
                members.append({
                    "name": student.get("name", ""),
                    "email": student.get("email", ""),
                    "prnNo": student.get("prnNo", "") or sp.get("prnNo", ""),
                })

            guide = group.get("guide", {}) or {}
            return {
                "success": True,
                "members": members,
                "guideName": guide.get("name", ""),
                "guideEmail": guide.get("email", ""),
                "groupName": group.get("name", ""),
                "error": None,
            }
    except Exception as e:
        return {
            "success": False,
            "members": [],
            "guideName": "",
            "guideEmail": "",
            "groupName": "",
            "error": str(e),
        }


async def get_department_students_emails(
    department_id: str, year: str, token: str
) -> dict:
    """Fetch all student emails in a department+year."""
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id
        if year:
            params["year"] = year

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/users/students",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            raw = data if isinstance(data, list) else data.get("users", data)

            students = []
            for s in raw:
                students.append({
                    "name": s.get("name", ""),
                    "email": s.get("email", ""),
                    "prnNo": s.get("prnNo", ""),
                })

            return {"success": True, "students": students, "count": len(students), "error": None}
    except Exception as e:
        return {"success": False, "students": [], "count": 0, "error": str(e)}


async def get_project_details(project_id: str, token: str) -> dict:
    """Fetch project details for review context."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/{project_id}",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            return {"success": True, "data": r.json(), "error": None}
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


async def get_my_projects(token: str) -> dict:
    """Fetch all projects visible to this user."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            projects = data if isinstance(data, list) else data.get("data", data)

            status_counts: dict[str, int] = {}
            for p in projects:
                s = p.get("status", "UNKNOWN")
                status_counts[s] = status_counts.get(s, 0) + 1

            return {
                "success": True,
                "data": projects,
                "statusCounts": status_counts,
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "statusCounts": {}, "error": str(e)}


async def get_all_departments(token: str) -> dict:
    """Fetch all departments with HOD info and counts."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/departments",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            depts = data if isinstance(data, list) else []
            return {"success": True, "data": depts, "count": len(depts), "error": None}
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def get_department_detail(dept_id: str, token: str) -> dict:
    """Fetch department detail with HOD, coordinators, guides."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/departments/{dept_id}",
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            return {"success": True, "data": r.json(), "error": None}
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


async def get_faculty(department_id: str, token: str) -> dict:
    """Fetch faculty in a department."""
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/users/faculty",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            faculty = data if isinstance(data, list) else data.get("users", data)
            return {"success": True, "data": faculty, "count": len(faculty), "error": None}
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def post_project_review(
    project_id: str,
    is_approved: bool,
    comment: str,
    rejection_reason: str,
    token: str,
) -> dict:
    """Post review to Node backend — writes to actual database."""
    try:
        body = {
            "isApproved": is_approved,
            "comment": comment,
        }
        if not is_approved and rejection_reason:
            body["rejectionReason"] = rejection_reason

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{NODE_BACKEND_URL}/api/projects/{project_id}/review",
                json=body,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            result = r.json()
            return {
                "success": True,
                "newStatus": result.get("status", result.get("newStatus", "")),
                "review": result,
                "error": None,
            }
    except Exception as e:
        return {"success": False, "newStatus": "", "review": {}, "error": str(e)}
