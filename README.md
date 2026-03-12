# EduTrack — College Project Management Platform

A full-stack platform for managing college final-year projects with AI-powered assistance. Supports multi-role access (Student, Guide, Coordinator, HOD, Admin) with features like group management, project reviews, email drafting, similarity checking, and a project showcase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Radix UI, Recharts |
| Backend | Express.js, Prisma ORM, PostgreSQL |
| AI Backend | FastAPI, LangGraph, LangChain |
| LLM | **OpenAI** (GPT-4o-mini / o3-mini) **or Ollama** (llama3:8b) |

---

## Prerequisites

- **Node.js** v18+ and **npm**
- **Python** 3.10+
- **PostgreSQL** 15+ (running locally or remote)
- **Ollama** (if using local LLM instead of OpenAI) — [Download Ollama](https://ollama.com/download)

---

## Project Structure

```
college-platform/
├── frontend/          # Next.js 14 App Router (port 3000)
├── backend/           # Express + Prisma API (port 5000)
├── ai-backend/        # FastAPI + LangGraph AI (port 8000)
└── README.md
```

---

## Setup Instructions

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd college-platform

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# AI Backend
cd ../ai-backend
pip install -r requirements.txt
```

### 2. PostgreSQL Database

Create a PostgreSQL database:

```sql
CREATE DATABASE edutrack;
```

### 3. Environment Variables

#### Backend — `backend/.env`

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/edutrack"
JWT_SECRET="your-secret-key-here"
PORT=5000
```

#### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_AI_URL=http://localhost:8000
```

#### AI Backend — `ai-backend/.env`

**Option A: Using Ollama (FREE, local)**

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b
NODE_BACKEND_URL=http://localhost:5000
PORT=8000
```

**Option B: Using OpenAI (paid API key)**

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
NODE_BACKEND_URL=http://localhost:5000
PORT=8000
```

### 4. Ollama Setup (if using local LLM)

```bash
# Install Ollama from https://ollama.com/download
# Then pull the model:
ollama pull llama3:8b

# Verify it's running:
ollama list
```

Ollama runs on `http://localhost:11434` by default. No API key needed.

### 5. Database Migration & Seed

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma db push

# Seed the database (84 students, 20 faculty, 1 admin, 4 departments, 20 groups)
npx prisma db seed
```

### 6. Start All Services

Open **3 terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# → Running on http://localhost:5000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# → Running on http://localhost:3000
```

**Terminal 3 — AI Backend**
```bash
cd ai-backend
uvicorn main:app --reload --port 8000
# → Running on http://localhost:8000
```

If using Ollama, make sure it's running (`ollama serve` or the Ollama desktop app).

---

## Default Login Credentials

All seeded users have the password: **`12345678`**

| Role | Email | Department |
|------|-------|-----------|
| Admin | pawarsamarth786@gmail.com | All |
| HOD | hod.entc@college.edu | ENTC |
| HOD | hod.cse@college.edu | CSE |
| Coordinator | coord.entc@college.edu | ENTC |
| Guide | guide1.entc@college.edu | ENTC |
| Student | student1.entc@college.edu | ENTC |

---

## Key Features by Role

### Student
- Form groups (3-5 members), send invitations
- Create/edit project with title, abstract, domain, SDG goals, tech stack
- **Check Project Uniqueness** — TF-IDF similarity checker (see below)
- AI-powered project idea generator

### Guide
- View assigned groups and projects
- Review & approve/reject project submissions
- Bulk upload (FF180-status, drive links, project links)
- Email drafting via AI chat

### Coordinator
- Manage all groups in their department/year
- Review, approve/reject, and publish projects
- **Bulk create groups** from Excel (with project titles & guide assignment)
- Bulk upload FF180, links
- Analytics dashboard with charts

### HOD
- Department-wide view of all groups, projects, faculty
- Review and publish projects
- Email all department students/faculty

### Admin
- Full platform access across all departments
- Change project statuses, manage faculty roles
- View all analytics

---

## Similarity Checker — How It Works

The similarity checker uses **TF-IDF (Term Frequency–Inverse Document Frequency) + Cosine Similarity** to detect if a project is too similar to existing ones.

### Algorithm
1. **Tokenization** — Project title + abstract + domain are lowercased, cleaned, and split into tokens (stop words removed)
2. **TF-IDF Vectorization** — Each project becomes a weighted vector where important/rare terms have higher values
3. **Cosine Similarity** — Compares the angle between two project vectors (0% = completely different, 100% = identical)
4. **Threshold** — Projects with ≥55% overall similarity are flagged

### What You See in the UI
When you click **"Check Uniqueness"**, each similar project shows:
- **Overall match %** — Combined similarity of title + abstract + domain
- **Title similarity bar** — How similar just the titles are (green/amber/red)
- **Abstract similarity bar** — How similar just the abstracts are
- **Common terms** — The shared important keywords driving the similarity

### Where to Test It

| Role | Page | How to Access |
|------|------|--------------|
| **Student** | Dashboard → Your project card | Click **"Check Uniqueness"** button below your project |
| **Guide** | Dashboard → Projects | Click any project → **"Check Project Uniqueness"** at the bottom |
| **Coordinator** | All Projects page | Click any project → **"Check Project Uniqueness"** at the bottom |
| **HOD** | Projects page | Click any project → **"Check Project Uniqueness"** at the bottom |
| **Admin** | Projects page | Click any project → **"Check Project Uniqueness"** at the bottom |

### Quick Test
1. Login as a student (e.g., `student1.entc@college.edu` / `12345678`)
2. If you have a project, click **"Check Uniqueness"** on your project card
3. If there are any projects with similar titles/abstracts, you'll see the detailed breakdown

To create a project that triggers similarity:
1. Login as a student who is a group leader
2. Create a project with a title similar to an existing one (e.g., "Smart Attendance System" if another group already has "Automated Attendance System")
3. Click **"Check Uniqueness"** to see the match

---

## AI Chat — Testing Guide

The AI chatbot (bottom-right icon) supports:

| Command Example | What It Does |
|----------------|-------------|
| "Hi" / "What can you do?" | Shows role-based capabilities |
| "How many groups do I have?" | Queries database |
| "Write email to ENTC-TY-A-G1 about deadline" | Drafts email to that group |
| "Email guide of group CSE-FIN-A-G1" | Emails only the guide |
| "Email all students about fest" | Emails all students in scope |
| "Generate project ideas on IoT" | AI idea generator |
| "Review project: looks good, approved" | Submits project review |

---

## Bulk Upload — Excel Templates

Go to **Bulk Upload** page (Coordinator or Guide sidebar). Download the template, fill it, upload.

| Type | Columns | Who Can Use |
|------|---------|------------|
| Create Groups | GroupName, Year, Division, GuidePRN, ProjectTitle, PRN1-PRN5 | Coordinator, HOD, Admin |
| FF180 Status | PRN, FF180Status | Guide, Coordinator, HOD, Admin |
| Drive Links | PRN, DriveLink | Guide, Coordinator, HOD, Admin |
| Project Links | PRN, githubLink, videoLink, driveLink, researchPaperLink, patentLink | Guide, Coordinator, HOD, Admin |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `prisma generate` fails | Make sure `DATABASE_URL` is set in `backend/.env` |
| AI chat returns errors | Check that AI backend is running on port 8000 and LLM is accessible |
| Ollama "connection refused" | Run `ollama serve` or start the Ollama desktop app |
| "Model not found" error | Run `ollama pull llama3:8b` to download the model |
| Gmail features not working | Gmail OAuth is optional — the email draft/send feature requires Google OAuth setup |
| Frontend shows blank page | Ensure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_AI_URL` are set in `frontend/.env.local` |