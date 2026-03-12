# 🤖 AI Agent Integration Roadmap — EduTrack Platform

> A comprehensive list of AI-powered agents that can be integrated into EduTrack to automate faculty workflows, reduce manual overhead, and streamline college project management. Faculty will mostly just **approve/reject** — the agents handle everything else.

---

## ✅ Currently Implemented Agents

| # | Agent | Category | What It Does | Backend Integration | Manual Work Eliminated |
|---|-------|----------|-------------|---------------------|----------------------|
| 1 | **Project Status Agent** | Project Mgmt | Changes project status (DRAFT → SUBMITTED → APPROVED etc.) via natural language | `PATCH /projects/:id/status` | Faculty manually navigating to project, selecting dropdown, clicking update |
| 2 | **Review Agent** | Evaluation | Adds reviews/grades/marks to projects, approves/rejects with comments | `POST /reviews`, `PATCH /projects/:id/status` | Faculty writing reviews manually for each project |
| 3 | **Analytics Agent** | Reporting | Generates department-level stats (project counts by status, guide load, domain distribution) | `GET /projects`, `GET /departments` | Faculty manually counting and compiling reports |
| 4 | **Email Agent** | Communication | Sends emails to specific groups, departments, or year-wise students via Gmail API | Gmail API + DB queries for email lists | Faculty composing emails and manually adding recipients |
| 5 | **Project Info Agent** | Query | Answers natural language questions about projects, groups, students | All GET endpoints | Faculty searching through dashboards to find info |

---

## 🚀 Proposed New Agents

### 📅 Calendar & Scheduling

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Google Tool | Priority |
|---|-------|----------|-------------|------------------------|----------------------|-------------|----------|
| 6 | **Review Scheduling Agent** | Calendar | Auto-schedules project review sessions based on faculty availability — creates calendar events with time slots | Google Calendar API + DB `reviews` table | Faculty manually coordinating 50+ review slots via WhatsApp/email | Google Calendar | 🔴 High |
| 7 | **Google Meet Link Generator** | Meetings | Generates Google Meet links for online reviews, vivas, or group discussions — attaches to calendar events | Google Meet API (via Calendar API) | Faculty creating Meet links manually and sharing via messages | Google Meet | 🔴 High |
| 8 | **Deadline Reminder Agent** | Notifications | Auto-sends reminders 7/3/1 days before submission deadlines to groups; escalates overdue projects to guide | Google Calendar API + Email/Push | Faculty manually tracking who hasn't submitted and sending reminders | Google Calendar | 🔴 High |
| 9 | **Presentation Scheduler** | Calendar | Schedules final project presentations — assigns time slots per group, avoids conflicts, sends calendar invites | Google Calendar API + DB groups | Faculty manually creating presentation timetable in Excel | Google Calendar | 🟡 Medium |

### 📊 Evaluation & Grading

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 10 | **Auto-Grading Assistant** | Evaluation | Reads project abstract + deliverables, suggests a grade based on rubric criteria (innovation, feasibility, completeness) | GPT-4o-mini + DB `reviews` table | Faculty reading 50+ abstracts and grading from scratch | 🟡 Medium |
| 11 | **Plagiarism/Similarity Detector** | Quality | Deep plagiarism check using abstract + report content — cross-references public databases and internal projects | External plagiarism API + `POST /check-similarity` | Faculty manually running plagiarism tools on each report | 🟡 Medium |
| 12 | **Rubric Generator Agent** | Evaluation | Generates custom evaluation rubrics based on project domain, SDG goals, and department criteria | GPT-4o-mini + DB schema | Faculty creating rubrics from scratch each semester | 🟢 Low |
| 13 | **Viva Question Generator** | Evaluation | Generates domain-specific viva questions based on project abstract, tech stack, and deliverables | GPT-4o-mini + project data | Faculty preparing viva questions manually for each group | 🟡 Medium |

### 📁 Google Workspace & Drive

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Google Tool | Priority |
|---|-------|----------|-------------|------------------------|----------------------|-------------|----------|
| 14 | **Drive Auto-Organizer** | File Mgmt | Creates structured Google Drive folders per department/year/group — auto-sets permissions for guide + students | Google Drive API + DB groups | Faculty manually creating 50+ folders and sharing them | Google Drive | 🔴 High |
| 15 | **Report Template Distributor** | Documents | Auto-creates project report templates (Google Docs) from department template and shares with each group | Google Docs API + Drive API | Faculty manually copying templates and sharing via groups | Google Docs | 🟡 Medium |
| 16 | **Sheets Marks Compiler** | Spreadsheets | Auto-compiles all review marks into a Google Sheet per department — pivot tables for guide-wise, domain-wise analysis | Google Sheets API + DB reviews | Faculty manually entering marks from dashboard into Excel | Google Sheets | 🔴 High |
| 17 | **Certificate Generator** | Documents | Generates project completion certificates (PDF) with student names, project title, guide name, department seal | Google Docs/Slides API + PDF export | Faculty manually editing certificate templates for each student | 🟡 Medium |
| 18 | **Google Forms Survey Agent** | Feedback | Creates and distributes feedback forms (peer review, guide satisfaction, project retrospective) | Google Forms API | Faculty manually creating forms and analyzing responses | Google Forms | 🟢 Low |

### 📈 Analytics & Reporting

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 19 | **Weekly Progress Report Agent** | Monitoring | Generates weekly PDF reports: projects submitted this week, pending reviews, overdue groups, guide workload | DB queries + PDF generation | Faculty manually compiling weekly reports for HOD | 🔴 High |
| 20 | **Faculty Workload Analyzer** | Analytics | Analyzes guide-wise project distribution, identifies overloaded/underloaded faculty, suggests rebalancing | DB `projects` + `faculty` tables | HOD manually counting projects per guide | 🟡 Medium |
| 21 | **Department Dashboard Agent** | Analytics | Generates interactive dashboards: project pipeline funnel, SDG coverage, domain distribution, completion rates | DB aggregation queries + chart library | Faculty manually creating charts in PowerPoint | 🟢 Low |
| 22 | **Semester Comparison Agent** | Analytics | Compares current semester metrics with previous semesters — identifies trends, improvements, areas of concern | Historical DB data | HOD manually comparing Excel sheets across semesters | 🟢 Low |

### 👥 Group & Student Management

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 23 | **Smart Group Formation Agent** | Grouping | Suggests optimal groups based on student skills, CGPA, domain interests — ensures balanced teams | DB `students` + profile data + GPT | Faculty manually forming 50+ groups based on student preferences | 🟡 Medium |
| 24 | **Guide Assignment Agent** | Assignment | Auto-assigns guides to groups based on guide expertise, current load, and project domain match | DB `faculty` expertise + `projects` domain | Coordinator manually matching guides to groups | 🟡 Medium |
| 25 | **Student Progress Tracker** | Monitoring | Tracks per-student contribution — GitHub commits, drive uploads, attendance — flags inactive members | GitHub API + Drive API + DB | Faculty manually monitoring which students are actually working | 🔴 High |
| 26 | **Attendance Tracker Agent** | Attendance | Marks attendance during review sessions, generates attendance reports, flags students with low attendance | DB attendance table + Calendar events | Faculty manually taking attendance and compiling reports | 🟡 Medium |

### 📧 Communication & Notifications

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Google Tool | Priority |
|---|-------|----------|-------------|------------------------|----------------------|-------------|----------|
| 27 | **Smart Notification Agent** | Alerts | Context-aware push notifications — review completed, status changed, deadline approaching, group formed | WebSocket/FCM + DB events | Students constantly checking dashboard for updates | 🔴 High |
| 28 | **WhatsApp/Telegram Bot Agent** | Messaging | Sends project updates, review results, and reminders via WhatsApp/Telegram bot | WhatsApp Business API / Telegram Bot API | Faculty using personal WhatsApp groups for official communication | 🟡 Medium |
| 29 | **Parent Notification Agent** | Communication | Sends semester progress reports to parents — project status, attendance, review marks | Email/SMS API + DB | Faculty manually informing parents about student performance | 🟢 Low |
| 30 | **Announcement Broadcast Agent** | Communication | Broadcasts announcements to specific departments, years, or groups — with read receipts | DB + Email + Push notifications | Faculty posting announcements on multiple channels manually | 🟡 Medium |

### 🧠 AI-Powered Content & Assistance

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 31 | **Abstract Improvement Agent** | Writing | Reviews student abstracts and suggests improvements — grammar, structure, academic tone, keyword optimization | GPT-4o-mini + project data | Faculty spending time correcting poorly written abstracts | 🟡 Medium |
| 32 | **Literature Survey Agent** | Research | Generates related work / literature survey based on project domain and abstract — cites real papers | GPT-4o-mini + Semantic Scholar API | Students struggling to find related work; faculty reviewing bad surveys | 🟡 Medium |
| 33 | **Tech Stack Recommender** | Advisory | Recommends optimal tech stack based on project requirements, team skills, and industry trends | GPT-4o-mini + project data | Students choosing inappropriate tools; faculty correcting tech choices | 🟢 Low |
| 34 | **Project Feasibility Checker** | Validation | Analyzes project scope, timeline, team size — flags over-ambitious or trivially simple projects | GPT-4o-mini + historical project data | Faculty manually assessing feasibility during initial review | 🟡 Medium |

### 🔄 Workflow Automation

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 35 | **Auto FF180 Tracker** | Compliance | Tracks FF180 form submissions per group, sends reminders, compiles department-level compliance reports | DB `FF180` table + Email | Faculty manually tracking which groups submitted FF180 forms | 🔴 High |
| 36 | **Bulk Status Updater Agent** | Workflow | Mass-updates project statuses — e.g., "approve all reviewed projects in CS department" via natural language | `PATCH /projects/:id/status` batch | Faculty clicking through 50+ projects to change status one by one |🟡 Medium |
| 37 | **End-of-Semester Agent** | Archival | Archives completed projects, generates final reports, resets system for next semester, backs up data | DB operations + Drive API | Faculty manually archiving, downloading, and cleaning up | 🟢 Low |
| 38 | **External Examiner Report Agent** | Reporting | Generates formatted reports for external examiners — project summaries, marks distribution, top projects | DB + PDF/Docs generation | Faculty manually compiling examiner reports | 🟡 Medium |

### 🏆 Showcase & Publication

| # | Agent | Category | What It Does | Backend/API Integration | Manual Work Eliminated | Priority |
|---|-------|----------|-------------|------------------------|----------------------|----------|
| 39 | **Patent Filing Assistant** | IP | Helps draft patent application structure based on project innovation — generates claims, prior art analysis | GPT-4o-mini + patent databases | Students/faculty struggling with patent filing format | 🟢 Low |
| 40 | **Research Paper Draft Agent** | Publication | Generates IEEE/Springer formatted paper drafts from project abstract, methodology, and results | GPT-4o-mini + LaTeX/Docs templates | Students spending weeks formatting papers incorrectly | 🟡 Medium |
| 41 | **Showcase Curator Agent** | Display | Auto-selects top projects for showcase based on grades, innovation score, completion status | DB queries + ranking algorithm | Faculty manually selecting showcase-worthy projects | 🟢 Low |

---

## 🔧 Implementation Priority Matrix

| Priority | Agents | Impact | Effort |
|----------|--------|--------|--------|
| 🔴 **High** (Do First) | Review Scheduler (#6), Meet Links (#7), Deadline Reminders (#8), Drive Organizer (#14), Sheets Compiler (#16), Weekly Reports (#19), Progress Tracker (#25), Smart Notifications (#27), FF180 Tracker (#35) | Very High — saves hours per week | Medium |
| 🟡 **Medium** (Next Phase) | Presentation Scheduler (#9), Auto-Grading (#10), Plagiarism (#11), Viva Questions (#13), Report Templates (#15), Certificates (#17), Workload Analyzer (#20), Smart Groups (#23), Guide Assignment (#24), Attendance (#26), Abstract Improvement (#31), Literature Survey (#32), Feasibility Checker (#34), Bulk Status (#36), Announcements (#30), Messaging (#28), Paper Drafts (#40), Examiner Reports (#38) | High — reduces significant manual effort | Medium–High |
| 🟢 **Low** (Future) | Rubric Generator (#12), Dashboard Agent (#21), Semester Comparison (#22), Parent Notifications (#29), Tech Recommender (#33), Archival (#37), Patent Assistant (#39), Showcase Curator (#41), Forms/Surveys (#18) | Moderate — nice-to-have improvements | Medium |

---

## 🔑 Required API Keys & Services

| Service | APIs Needed | Used By Agents |
|---------|------------|----------------|
| **Google Calendar** | Calendar API v3 | #6, #7, #8, #9, #26 |
| **Google Meet** | Calendar API (conferenceData) | #7 |
| **Google Drive** | Drive API v3 | #14, #25, #37 |
| **Google Docs** | Docs API v1 | #15, #17 |
| **Google Sheets** | Sheets API v4 | #16 |
| **Google Forms** | Forms API v1 | #18 |
| **Gmail** | Gmail API v1 | Already integrated (#4) |
| **OpenAI** | GPT-4o-mini | Already integrated, used by #10, #13, #31, #32, #33, #34, #40, #41 |
| **GitHub** | GitHub REST API v3 | #25 (commit tracking) |
| **Semantic Scholar** | Academic paper search API | #32 |
| **WhatsApp** | Business Cloud API | #28 |
| **Firebase/FCM** | Cloud Messaging | #27 |

---

## 💡 Architecture Pattern

All agents follow the same LangGraph pattern already used in the platform:

```
User (Natural Language) → Supervisor Agent → Tool Selection → API Call → DB Update → Response
```

**Faculty workflow**: Speak naturally → Agent executes → Faculty approves result

**Example**: _"Schedule reviews for all CS final year groups next week, 30 min each, send Meet links"_
→ Review Scheduling Agent reads groups → creates Calendar events with Meet → sends email invites → done.

---

_Last updated: Auto-generated for EduTrack College Platform_
