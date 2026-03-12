# EduTrack AI Agent Testing Guide

> **Before testing:** Start all three servers.
> ```bash
> # Terminal 1 – Node backend
> cd backend && node server.js
>
> # Terminal 2 – Next.js frontend
> cd frontend && npm run dev
>
> # Terminal 3 – AI backend
> cd ai-backend && python main.py
> ```
> AI backend runs on **http://localhost:8000**  
> Frontend runs on **http://localhost:3000**

---

## Health Check (Always run first)

**URL:** `http://localhost:8000/health`

**Expected response when everything is working:**
```json
{
  "status": "healthy",
  "model": "o3-mini",
  "openaiConnected": true,
  "gmailConnected": true,
  "message": "All systems operational"
}
```

- `openaiConnected: true` = OpenAI API key is working  
- `gmailConnected: true` = Google OAuth is set up (optional for most tests)  
- If `gmailConnected: false`, all agents still work except the **actual email send step**

---

## How to Access the AI Chat Panel

The AI chat panel is the **orange floating button** (bottom-right corner) visible on every dashboard page after login.

1. Login at `http://localhost:3000/login`
2. Look for the orange chat button (`💬`) in the bottom-right
3. Click it to open the chat panel
4. Type your message and press **Enter** or click the send button

> The chat panel automatically sends your JWT token and role to the AI backend.

---

## Agent 1: Intent Classifier

This agent runs automatically on every message — it is **not called directly**. It classifies your message into one of 5 intents and routes to the right agent.

| Your Message | Expected Intent | Routed To |
|---|---|---|
| `"Send email to my group"` | `EMAIL_DRAFT` | email_agent |
| `"Approve this project"` | `REVIEW_FEEDBACK` | review_agent |
| `"How many projects are submitted?"` | `DB_QUERY` | db_query_agent |
| `"Give me IoT project ideas"` | `IDEA_GENERATOR` (students only) | idea_generator_agent |
| `"List all faculty"` | `DB_QUERY` | db_query_agent |
| `"Who is HOD of Computer Engineering?"` | `DB_QUERY` | db_query_agent |
| `"Hello"` or `"What can you do?"` | `GENERAL` | general fallback |

> **Note:** Students can only access `IDEA_GENERATOR` and `GENERAL`. Any other intent from a student falls back to `GENERAL`.  
> **Note:** Non-students asking for project ideas get `GENERAL` — IDEA_GENERATOR is student-only.

---

## Agent 2: Email Agent

**Who can use:** GUIDE, COORDINATOR, HOD, ADMIN  
**Purpose:** Draft a professional email to send to a group, department, or year

### Test Messages (type these in the chat panel as Guide or Coordinator)

#### Test 1 — Email to a specific group
```
Send an email to my group reminding them to submit the FF180 form before this Friday.
```
**Expected response:**
- A formatted email draft with a `Subject:` line, greeting, body, sign-off
- Header shows: `📧 Email Draft — X recipients`
- Action buttons: **Send Email** | **Regenerate**

#### Test 2 — Announcement to department students
```
Send an announcement email to all students in my department about the upcoming project presentation schedule on 20th March.
```
**Expected response:**
- Broader email draft
- Action buttons: **Send Email** | **Regenerate**

#### Test 3 — Follow-up after review
```
Draft an email to my group telling them their project has been rejected and they need to improve the abstract and resubmit by next week.
```
**Expected response:**
- Professionally worded feedback/rejection email
- Action buttons: **Send Email** | **Regenerate**

### Clicking "Send Email"
- Click the **Send Email** button in the chat
- The AI backend calls Gmail API using OAuth credentials
- **If Gmail is connected** (`gmailConnected: true`): Chat shows `✓ Email sent to X recipients.`
- **If Gmail is not connected** (`gmailConnected: false`): Chat shows `✗ Failed: ...` with error message
- The email arrives in the recipients' inboxes from your connected Google account

### Important: Group Targeting
- If your message says "my group" or you have one group, it targets that group
- If you have multiple groups, it picks the first one found
- To target a specific group, mention the group name: `"Send email to Group Alpha about..."`

---

## Agent 3: Review Agent

**Who can use:** GUIDE, COORDINATOR, HOD  
**Purpose:** Draft an approval or rejection review comment for a project

### Test Messages

#### Test 1 — Approval review
```
Approve this project. The implementation is solid and the team has clearly understood the SDG alignment. Good work overall.
```
**Expected response:**
- Positive review draft with amber left border
- Mentions the project title (if context has projectId) or writes a generic approval
- Action buttons: **Submit Review** | **Regenerate**

#### Test 2 — Rejection review
```
Reject this project. The abstract is vague, there is no clear problem statement, and the tech stack is missing. Ask them to revise and resubmit.
```
**Expected response:**
- Constructive rejection feedback draft with red left border
- Lists specific improvement areas
- Action buttons: **Submit Review** | **Regenerate**

#### Test 3 — Rejection with specific reason
```
I want to reject this project because the IoT sensor selection is not justified and there is no mention of data security. They need to add a security analysis section.
```
**Expected response:**
- Detailed rejection with specific technical feedback
- Action buttons: **Submit Review** | **Regenerate**

### Clicking "Submit Review"
- Click the **Submit Review** button
- The AI backend calls your Node.js backend `POST /api/projects/{id}/review`
- **If projectId is in context**: Review is posted to the actual project
- **If no context**: Will fail (need to provide project ID via context)
- Chat shows: `✓ Review posted: project is now APPROVED/REJECTED`

> **Tip:** Currently the chat panel sends `context: {}` (empty). For the review agent to post to the correct project, you need to be on a page that provides `projectId` in context, or extend the chat panel to accept it.

---

## Agent 4: DB Query Agent

**Who can use:** GUIDE, COORDINATOR, HOD, ADMIN (and STUDENT with limited data)  
**Purpose:** Query and summarize departments, faculty, students, groups, and projects data

The DB Query Agent now fetches:
- **Departments** with HOD names, group counts, student counts
- **Faculty** with roles, designation, email (ADMIN/HOD/COORDINATOR only)
- **Groups** with members, guide, status, department, project info
- **Projects** with status, domain, guide, department, published state

### Test Messages

#### Test 1 — Project count by status
```
How many projects are submitted? Show me a breakdown by status.
```
**Expected response:**
- Natural language summary with status breakdown across all visible projects
- Action buttons: **Export Data** | **Refresh**

#### Test 2 — Group summary
```
Show me a summary of all my groups and which ones have submitted projects.
```
**Expected response:**
- Lists each group with name, member count, guide name, department, and project status
- Action buttons: **Export Data** | **Refresh**

#### Test 3 — Faculty list (ADMIN/HOD only)
```
Can you give me a list of all faculty?
```
**Expected response:**
- Lists all faculty with name, designation, roles, email, department
- ADMIN sees faculty across all departments
- HOD sees faculty in their department only

#### Test 4 — HOD query
```
Who is the HOD of Computer Engineering?
```
**Expected response:**
- Names the HOD of the specified department from department data
- Includes department stats (group count, student count)

#### Test 5 — Department overview
```
Show me all departments with their HODs and student counts.
```
**Expected response:**
- Lists all departments with HOD name, group count, student count

#### Test 6 — Dashboard overview
```
Give me a complete overview of all groups and projects.
```
**Expected response:**
- Full summary with departments, groups, projects, and status breakdowns

---

## Agent 5: Idea Generator Agent

**Who can use:** STUDENT only  
**Purpose:** Build a ready-to-use prompt template for ChatGPT/Claude — the AI does NOT generate ideas itself

### Test Messages (use a Student account)

#### Test 1 — Basic domain request
```
Give me project ideas for IoT domain.
```
**Expected response:**
- A copyable, detailed ChatGPT/Claude prompt template
- Note: `isTemplate: true` (shown with dashed amber border in chat)
- Action buttons: **Copy Prompt** | **Open ChatGPT** | **Open Claude** | **Regenerate**

#### Test 2 — Domain + SDG goal
```
I want project ideas in AI/ML related to SDG 4 Quality Education. Include feasibility criteria.
```
**Expected response:**
- Template with domain = AI/ML and SDG 4 requirement
- Full structured prompt with tech stack and feasibility sections
- Action buttons: **Copy Prompt** | **Open ChatGPT** | **Open Claude**

#### Test 3 — Specific tech stack
```
Give me Blockchain project ideas that are suitable for research paper publication.
```
**Expected response:**
- Template emphasizing research/publication feasibility
- Blockchain domain highlighted

### Clicking action buttons
- **Copy Prompt** → Copies the full template text to clipboard (toast: "Copied!")
- **Open ChatGPT** → Opens `https://chat.openai.com` in a new tab
- **Open Claude** → Opens `https://claude.ai` in a new tab
- Paste the copied template into ChatGPT/Claude to get actual project ideas

---

## General Fallback (no specific intent)

Works for all roles.

### Test Messages

#### Test 1
```
Hello, what can you help me with?
```
**Expected response:**
- Friendly introduction listing capabilities based on your role
- ADMIN: mentions department data, faculty queries, email drafting, project review
- GUIDE: mentions email drafting, project review, group data queries
- STUDENT: mentions project ideas, general questions
- Response is detailed and role-specific (3-6 sentences)

#### Test 2
```
What are the different project statuses in our system?
```
**Expected response:**
- General answer about DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → COMPLETED → PUBLISHED

---

## Role-Based Access Summary

| Feature | STUDENT | GUIDE | COORDINATOR | HOD | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| Idea Generator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Email Agent | ❌ | ✅ | ✅ | ✅ | ✅ |
| Review Agent | ❌ | ✅ | ✅ | ✅ | ✅ |
| DB Query Agent | Limited | ✅ | ✅ | ✅ | ✅ |
| General Fallback | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Gmail Setup (Required for actual email sending)

If `gmailConnected: false`, follow these steps **once** to enable real email sending:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Gmail API**
3. Go to **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
   - Application type: **Desktop App**
   - Name: `EduTrack Local`
4. Download JSON → rename to `client_secret.json`
5. Place it at: `ai-backend/credentials/client_secret.json`
6. Restart the AI backend (`python main.py`)
7. Browser opens automatically → log in with the Gmail account you want to send FROM
8. `token.json` is created in `credentials/` — keep it safe, never commit it
9. All future runs auto-refresh the token

**After setup:** Any email drafted by the AI can be sent FROM this Gmail account TO any email address (the recipient doesn't need a Gmail account).

---

## Curl Commands for Direct Testing

Get a JWT token first:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "guide1@college.edu", "password": "12345678"}'
# Copy the "token" value from the response
```

### Health check
```bash
curl http://localhost:8000/health
```

### Email agent (replace TOKEN)
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Draft an email to my group about submitting the FF180 form by Friday", "userRole": "GUIDE", "context": {}}'
```

### Review agent
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Approve the project, the implementation is complete and well documented", "userRole": "GUIDE", "context": {"projectId": "PROJECT_ID_HERE"}}'
```

### DB query agent
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Show me a summary of all my groups and their project statuses", "userRole": "COORDINATOR", "context": {}}'
```

### Idea generator (student)
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -d '{"message": "Give me AI/ML project ideas related to healthcare", "userRole": "STUDENT", "context": {}}'
```

### Execute send email action (after drafting)
```bash
curl -X POST http://localhost:8000/api/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "actionType": "SEND_EMAIL",
    "agentUsed": "email_agent",
    "draftContent": "PASTE THE EMAIL DRAFT TEXT HERE",
    "context": {
      "recipients": ["student@example.com"],
      "subject": "FF180 Submission Reminder"
    }
  }'
```

---

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `pawarsamarth786@gmail.com` | `12345678` |
| Guide | `guide1@college.edu` | `12345678` |
| Coordinator | `coord1@college.edu` | `12345678` |
| HOD | `hod1@college.edu` | `12345678` |
| Student | *(check seeded students)* | `12345678` |
