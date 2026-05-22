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


async def search_all_groups(token: str, group_name: str = "", department_id: str = "") -> dict:
    """Search for groups across all accessible departments (for ADMIN/HOD)."""
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id
        
        print(f"🔍 DEBUG search_all_groups: group_name='{group_name}', department_id='{department_id}', params={params}")
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/groups",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            all_groups = data if isinstance(data, list) else data.get("data", data)
            
            print(f"🔍 DEBUG search_all_groups: got {len(all_groups)} total groups from API")
            
            # Filter by group name if provided (with smart prefix and substring matching)
            if group_name:
                q_upper = group_name.upper().strip()
                q_clean = q_upper.replace("GROUP ", "").strip()
                
                filtered = []
                for g in all_groups:
                    g_name = g.get("name", "").upper().strip()
                    g_clean = g_name.replace("GROUP ", "").strip()
                    
                    if (g_name == q_upper or 
                        g_clean == q_clean or 
                        (q_clean and q_clean in g_clean) or 
                        (g_clean and g_clean in q_clean)):
                        filtered.append(g)
                
                print(f"🔍 DEBUG search_all_groups: filtered to {len(filtered)} groups matching '{group_name}'")
                if len(filtered) > 0:
                    print(f"🔍 DEBUG search_all_groups: matching groups: {[g.get('name', '') for g in filtered]}")
                return {"success": True, "data": filtered, "count": len(filtered), "error": None}
            
            return {"success": True, "data": all_groups, "count": len(all_groups), "error": None}
    except Exception as e:
        print(f"❌ DEBUG search_all_groups exception: {e}")
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


# ─── New Query Functions for AI Agents ────────────────────────


async def get_projects_by_status(token: str, status: str = None, department_id: str = None) -> dict:
    """
    Fetch projects filtered by status and/or department.

    Args:
        token: Auth token
        status: ProjectStatus enum value (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, PUBLISHED)
        department_id: Optional department filter

    Returns:
        { success: bool, data: list, statusCounts: dict, error: str }
    """
    try:
        params = {}
        if status:
            params["status"] = status
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            data = r.json()
            projects = data if isinstance(data, list) else data.get("data", data)

            # Count by status
            status_counts: dict[str, int] = {}
            for p in projects:
                s = p.get("status", "UNKNOWN")
                status_counts[s] = status_counts.get(s, 0) + 1

            return {
                "success": True,
                "data": projects,
                "count": len(projects),
                "statusCounts": status_counts,
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "statusCounts": {}, "error": str(e)}


async def get_review_marks(token: str, department_id: str = None) -> dict:
    """
    Fetch all project reviews with marks/grades for Sheets compilation.
    Returns project info + all reviews for each project.

    Args:
        token: Auth token
        department_id: Optional department filter

    Returns:
        { success: bool, data: list[{project, reviews}], error: str }
    """
    try:
        # First get all projects
        params = {}
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            projects = r.json()
            if not isinstance(projects, list):
                projects = projects.get("data", [])

            # For each project that has reviews, fetch full details
            results = []
            for proj in projects:
                # Fetch full project with reviews
                detail_r = await client.get(
                    f"{NODE_BACKEND_URL}/api/projects/{proj['id']}",
                    headers=_auth_headers(token),
                )
                if detail_r.status_code == 200:
                    detail = detail_r.json()
                    results.append({
                        "projectId": detail.get("id"),
                        "projectTitle": detail.get("title"),
                        "groupName": detail.get("group", {}).get("name", ""),
                        "year": detail.get("group", {}).get("year", ""),
                        "division": detail.get("group", {}).get("division", ""),
                        "status": detail.get("status"),
                        "ff180Status": detail.get("ff180Status"),
                        "guideName": detail.get("guide", {}).get("name", "") if detail.get("guide") else "",
                        "reviews": detail.get("reviews", []),
                        "latestReview": detail.get("reviews", [{}])[0] if detail.get("reviews") else None,
                    })

            return {
                "success": True,
                "data": results,
                "count": len(results),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def get_ff180_status(token: str, department_id: str = None, year: str = None) -> dict:
    """
    Fetch FF180 form submission status for all projects.

    Args:
        token: Auth token
        department_id: Optional department filter
        year: Optional year filter (FY, SY, TY, FINAL)

    Returns:
        { success: bool, data: list, statusCounts: dict, error: str }
    """
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            projects = r.json()
            if not isinstance(projects, list):
                projects = projects.get("data", [])

            # Filter by year if specified
            if year:
                projects = [p for p in projects if p.get("group", {}).get("year") == year]

            # Get FF180 status for each project
            results = []
            ff180_counts = {"PENDING": 0, "SUBMITTED": 0, "APPROVED": 0}

            for proj in projects:
                # Need to fetch full project details for ff180Status
                detail_r = await client.get(
                    f"{NODE_BACKEND_URL}/api/projects/{proj['id']}",
                    headers=_auth_headers(token),
                )
                if detail_r.status_code == 200:
                    detail = detail_r.json()
                    ff180 = detail.get("ff180Status", "PENDING")
                    ff180_counts[ff180] = ff180_counts.get(ff180, 0) + 1

                    results.append({
                        "projectId": detail.get("id"),
                        "projectTitle": detail.get("title"),
                        "groupName": detail.get("group", {}).get("name", ""),
                        "year": detail.get("group", {}).get("year", ""),
                        "ff180Status": ff180,
                        "guideName": detail.get("guide", {}).get("name", "") if detail.get("guide") else "",
                    })

            return {
                "success": True,
                "data": results,
                "count": len(results),
                "statusCounts": ff180_counts,
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "statusCounts": {}, "error": str(e)}


async def get_guide_workload(token: str, department_id: str = None) -> dict:
    """
    Analyze guide workload — count of projects per guide.

    Args:
        token: Auth token
        department_id: Optional department filter

    Returns:
        { success: bool, data: list[{guide, projectCount, projects}], error: str }
    """
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            projects = r.json()
            if not isinstance(projects, list):
                projects = projects.get("data", [])

            # Aggregate by guide
            guide_map: dict[str, dict] = {}

            for proj in projects:
                guide = proj.get("guide")
                if guide:
                    guide_name = guide.get("name", "Unknown")
                    if guide_name not in guide_map:
                        guide_map[guide_name] = {
                            "guideName": guide_name,
                            "guidePRN": guide.get("prnNo", ""),
                            "projectCount": 0,
                            "projects": [],
                            "statusBreakdown": {},
                        }

                    guide_map[guide_name]["projectCount"] += 1
                    guide_map[guide_name]["projects"].append({
                        "title": proj.get("title"),
                        "groupName": proj.get("group", {}).get("name", ""),
                        "status": proj.get("status"),
                    })

                    status = proj.get("status", "UNKNOWN")
                    guide_map[guide_name]["statusBreakdown"][status] = \
                        guide_map[guide_name]["statusBreakdown"].get(status, 0) + 1

            # Sort by project count descending
            sorted_guides = sorted(
                guide_map.values(),
                key=lambda x: x["projectCount"],
                reverse=True
            )

            return {
                "success": True,
                "data": sorted_guides,
                "count": len(sorted_guides),
                "totalProjects": len(projects),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "totalProjects": 0, "error": str(e)}


async def get_overdue_groups(token: str, department_id: str = None, days_threshold: int = 30) -> dict:
    """
    Find groups with projects stuck in DRAFT or overdue for submission.
    A project is considered overdue if it's been in DRAFT status for more than days_threshold days.

    Args:
        token: Auth token
        department_id: Optional department filter
        days_threshold: Days after which a DRAFT project is considered overdue (default: 30)

    Returns:
        { success: bool, data: list[{group, project, daysSinceCreation}], error: str }
    """
    from datetime import datetime, timezone

    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            projects = r.json()
            if not isinstance(projects, list):
                projects = projects.get("data", [])

            # Filter to DRAFT projects only
            draft_projects = [p for p in projects if p.get("status") == "DRAFT"]

            overdue = []
            now = datetime.now(timezone.utc)

            for proj in draft_projects:
                # Fetch full project to get createdAt
                detail_r = await client.get(
                    f"{NODE_BACKEND_URL}/api/projects/{proj['id']}",
                    headers=_auth_headers(token),
                )
                if detail_r.status_code == 200:
                    detail = detail_r.json()
                    created_str = detail.get("createdAt", "")

                    if created_str:
                        try:
                            created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                            days_since = (now - created).days

                            if days_since >= days_threshold:
                                overdue.append({
                                    "projectId": detail.get("id"),
                                    "projectTitle": detail.get("title"),
                                    "groupName": detail.get("group", {}).get("name", ""),
                                    "year": detail.get("group", {}).get("year", ""),
                                    "division": detail.get("group", {}).get("division", ""),
                                    "guideName": detail.get("guide", {}).get("name", "") if detail.get("guide") else "",
                                    "guideEmail": detail.get("guide", {}).get("email", "") if detail.get("guide") else "",
                                    "daysSinceCreation": days_since,
                                    "createdAt": created_str,
                                })
                        except Exception:
                            pass

            # Sort by days since creation descending (most overdue first)
            overdue.sort(key=lambda x: x["daysSinceCreation"], reverse=True)

            return {
                "success": True,
                "data": overdue,
                "count": len(overdue),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def get_all_students_with_profiles(
    token: str,
    department_id: str = None,
    year: str = None,
) -> dict:
    """
    Fetch all students with their complete profiles (PRN, enrollment, etc.).

    Args:
        token: Auth token
        department_id: Optional department filter
        year: Optional year filter (FY, SY, TY, FINAL)

    Returns:
        { success: bool, data: list[{student profile data}], error: str }
    """
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
                profile = s.get("studentProfile", {}) or {}
                students.append({
                    "id": s.get("id"),
                    "name": s.get("name", ""),
                    "email": s.get("email", ""),
                    "phone": s.get("phone", ""),
                    "prnNo": profile.get("prnNo", ""),
                    "enrollmentNo": profile.get("enrollmentNo", ""),
                    "year": profile.get("year", ""),
                    "division": profile.get("division", ""),
                    "departmentId": profile.get("departmentId", ""),
                })

            return {
                "success": True,
                "data": students,
                "count": len(students),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def get_groups_without_projects(token: str, department_id: str = None, year: str = None) -> dict:
    """
    Find groups that don't have a project created yet.

    Args:
        token: Auth token
        department_id: Optional department filter
        year: Optional year filter

    Returns:
        { success: bool, data: list[groups], error: str }
    """
    try:
        params = {}
        if department_id:
            params["departmentId"] = department_id

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Get all groups
            groups_r = await client.get(
                f"{NODE_BACKEND_URL}/api/groups",
                params=params,
                headers=_auth_headers(token),
            )
            groups_r.raise_for_status()
            groups = groups_r.json()
            if not isinstance(groups, list):
                groups = groups.get("data", [])

            # Get all projects
            projects_r = await client.get(
                f"{NODE_BACKEND_URL}/api/projects/all",
                params=params,
                headers=_auth_headers(token),
            )
            projects_r.raise_for_status()
            projects = projects_r.json()
            if not isinstance(projects, list):
                projects = projects.get("data", [])

            # Find group IDs that have projects
            groups_with_projects = {p.get("group", {}).get("id") for p in projects if p.get("group")}

            # Filter groups without projects
            groups_without = [
                g for g in groups
                if g.get("id") not in groups_with_projects
                and (not year or g.get("year") == year)
            ]

            results = []
            for g in groups_without:
                guide = g.get("guide", {}) or {}
                results.append({
                    "groupId": g.get("id"),
                    "groupName": g.get("name"),
                    "year": g.get("year"),
                    "division": g.get("division"),
                    "memberCount": g.get("_count", {}).get("members", len(g.get("members", []))),
                    "guideName": guide.get("name", ""),
                    "guideEmail": guide.get("email", ""),
                })

            return {
                "success": True,
                "data": results,
                "count": len(results),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "data": [], "count": 0, "error": str(e)}


async def update_project_status(
    project_id: str,
    new_status: str,
    token: str,
) -> dict:
    """
    Force-update a project's status (HOD/ADMIN only).

    Args:
        project_id: Project ID
        new_status: New status (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, PUBLISHED)
        token: Auth token

    Returns:
        { success: bool, message: str, error: str }
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.patch(
                f"{NODE_BACKEND_URL}/api/projects/{project_id}/status",
                json={"status": new_status},
                headers=_auth_headers(token),
            )
            r.raise_for_status()
            result = r.json()
            return {
                "success": True,
                "message": result.get("message", f"Status updated to {new_status}"),
                "error": None,
            }
    except Exception as e:
        return {"success": False, "message": "", "error": str(e)}


async def bulk_update_project_status(
    project_ids: list[str],
    new_status: str,
    token: str,
) -> dict:
    """
    Bulk update multiple projects' status.

    Args:
        project_ids: List of project IDs
        new_status: New status to set
        token: Auth token

    Returns:
        { success: bool, updated: int, failed: int, errors: list, error: str }
    """
    updated = 0
    failed = 0
    errors = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for pid in project_ids:
                try:
                    r = await client.patch(
                        f"{NODE_BACKEND_URL}/api/projects/{pid}/status",
                        json={"status": new_status},
                        headers=_auth_headers(token),
                    )
                    if r.status_code == 200:
                        updated += 1
                    else:
                        failed += 1
                        errors.append({"projectId": pid, "error": r.text})
                except Exception as e:
                    failed += 1
                    errors.append({"projectId": pid, "error": str(e)})

        return {
            "success": failed == 0,
            "updated": updated,
            "failed": failed,
            "errors": errors,
            "error": None if failed == 0 else f"{failed} projects failed to update",
        }
    except Exception as e:
        return {"success": False, "updated": updated, "failed": failed, "errors": errors, "error": str(e)}
