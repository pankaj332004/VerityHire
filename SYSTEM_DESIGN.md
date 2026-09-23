# AI-Powered Campus Placement Portal — System Design (VerityHire)

## 1. Vision
A campus placement system where AI **recommends**, humans **decide**, and every decision is **explainable and auditable**.

### Differentiators beyond a standard ATS:
- **Explainable candidate–job matching** (not a black-box score).
- **Personalized skill-gap analysis** for students.
- **"What-if" career simulation** (predict match score change upon learning skills).
- **Human-in-the-loop shortlisting** with mandatory override reasons.
- **Full audit trail** for fairness, compliance, and university accreditation.

---

## 2. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React.js (Vite) + Tailwind CSS + Lucide Icons |
| **Backend API** | Node.js + Express.js |
| **Database** | MongoDB Atlas (Mongoose) |
| **ML Service** | Python (FastAPI) + scikit-learn + spaCy + Sentence-Transformers |
| **Reasoning / Explanations** | LLM API (Google Gemini / OpenAI) |
| **Authentication** | JWT (Access + Refresh tokens) + bcryptjs |
| **File Storage** | Cloudinary (Resumes, logos, verification documents) |
| **Cache** | Redis (Embeddings + LLM explanation cache) |

---

## 3. High-Level Architecture

```
┌───────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│  React + Tailwind │ <────> │   Node.js / Express  │ <────> │    MongoDB Atlas    │
│  Student /        │        │   Auth, CRUD, jobs,  │        │   users, jobs,      │
│  Recruiter / Admin│        │   orchestration,     │        │   applications,     │
│  Dashboards       │        │   audit logging      │        │   audit_logs, etc.  │
└───────────────────┘        └──────────┬───────────┘        └─────────────────────┘
                                        │  internal REST
                                        ▼
                             ┌──────────────────────┐
                             │   Python ML Service  │
                             │   (FastAPI)          │
                             │  - Resume parsing    │
                             │    (spaCy NER)       │
                             │  - Embeddings        │
                             │    (Sentence-        │
                             │     Transformers)    │
                             │  - Ranking model     │
                             │    (scikit-learn)    │
                             │  - Explanation &     │
                             │    skill-gap (LLM)   │
                             └──────────────────────┘
```

### Architectural Principles:
1. **Stateless ML Service:** Receives text/vectors, returns scores and explanations. Node + Mongo remain the single source of truth.
2. **Redis Cache:** Sits behind the ML service, caching embeddings (keyed on `resumeId/jobId + modelVersion`) and LLM explanations (keyed on `applicationId + modelVersion`). Recomputes only when a resume, JD, or model version changes.

---

## 4. Core Services & API Contracts

### 4.1 Node/Express Endpoints
```http
POST   /api/auth/register            # student | recruiter | admin
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me

GET    /api/students/:id/profile
PUT    /api/students/:id/profile
POST   /api/students/:id/resume      # uploads to Cloudinary, triggers parse

POST   /api/jobs                     # (recruiter creates job)
GET    /api/jobs                     # (filter by CGPA, branch, search)
GET    /api/jobs/:id
POST   /api/jobs/:id/apply           # (student applies)

POST   /api/jobs/:id/shortlist       # Stage 1 hard filters + Stage 2 ML /score
PATCH  /api/applications/:id/status  # requires non-empty `reason` if overriding AI rank

POST   /api/students/:id/skill-gap   # calls ML /skill-gap
POST   /api/students/:id/simulate    # calls ML /simulate

GET    /api/admin/audit-logs
GET    /api/admin/analytics
```

### 4.2 Python ML Service Endpoints (FastAPI)
```http
POST   /parse-resume        { resumeText }                                → parsed entities (skills, edu, exp)
POST   /embed               { text }                                      → dense vector
POST   /score               { jdText, requiredSkills, studentProfile }    → ranked score + feature breakdown
POST   /explain             { jd, resume, features }                      → LLM-grounded explanation
POST   /skill-gap           { studentSkills, requiredSkills }             → missing skills + curated resources
POST   /simulate            { currentScore, hypotheticalSkills, target }  → projected score delta
```

---

## 5. AI Shortlisting Pipeline

1. **Stage 1 - Hard Filters** (Node.js/Mongo query — fast, deterministic):
   - CGPA cutoff
   - Branch eligibility
   - Maximum allowed backlogs
   - Batch year
2. **Resume Parsing** (`spaCy` NER / PDF parser):
   - Extracts skills, education, experience, and projects.
   - Allows candidate review and correction.
3. **Semantic Matching** (`Sentence-Transformers`):
   - Embeds JD and candidate skills into mathematical vectors.
   - Computes cosine similarity to detect conceptual match beyond exact keywords.
4. **Multi-Factor Ranking Model** (`scikit-learn` / Weighted formula):
   - $\text{Final Score} = (0.40 \times \text{Skill Overlap}) + (0.20 \times \text{CGPA Fit}) + (0.20 \times \text{Semantic Fit}) + (0.20 \times \text{Project Fit})$
5. **Explainability Layer** (LLM):
   - Generates human-readable rationale citing only matched and missing evidence without hallucination.

---

## 6. MongoDB Schema

```js
// users
{ _id, email, passwordHash, role: "student"|"recruiter"|"admin", isVerified, createdAt }

// students
{
  _id, userId, name, rollNumber, branch, batch, cgpa, backlogs,
  resumeUrl, resumeText,
  parsedProfile: {
    skills: [String],
    experience: [{ title, org, duration, description }],
    education: [{ degree, institute, year, score }],
    projects: [{ title, description, techStack, link }]
  },
  embeddings: { vector: [Number], modelVersion }
}

// recruiters
{ _id, userId, companyName, companyLogoUrl, website, industry, description, verified }

// jobs
{
  _id, recruiterId, title, description, jdText,
  skillsRequired: [String],
  eligibility: { minCgpa, branches: [String], maxBacklogs, batch },
  ctc, location, deadline, status: "open"|"closed",
  jdEmbedding: { vector: [Number], modelVersion }
}

// applications
{
  _id, jobId, studentId,
  status: "applied"|"shortlisted"|"interview"|"offered"|"rejected",
  aiScore: {
    finalScore: Number,
    featureBreakdown: [{ feature, value, weight }],
    matchedSkills: [String],
    missingSkills: [String],
    explanation: { summary: String, modelVersion: String },
    scoredAt: Date
  },
  appliedAt,
  statusHistory: [{ status, changedAt, changedBy, reason }]
}

// skill_gap_reports
{
  studentId, targetJobId, targetRole,
  currentSkills: [String], requiredSkills: [String], missingSkills: [String],
  recommendations: [{ skill, resourceType, title, url }],
  generatedAt
}

// audit_logs (append-only)
{
  entityType: "application"|"job"|"student",
  entityId,
  action: "ai_scored"|"recruiter_shortlisted"|"recruiter_rejected"|"recruiter_overrode_ai"|"status_changed",
  actor: { type: "system"|"user", userId, role },
  before, after,
  reason: String, // MANDATORY on override
  aiScoreAtTimeOfAction: Number,
  timestamp
}
```

---

## 7. Dashboards

### Student Dashboard
- Application tracker with live status updates.
- Profile and resume editor with parsed entity tags.
- Personalized skill-gap report with direct learning resources.
- Interactive "What-If" career simulator.

### Recruiter Dashboard
- Job posting and requirement configuration.
- Ranked applicant funnel with AI scores, feature breakdown, and grounded rationale.
- Candidate shortlisting and rejection actions with mandatory override accountability.

### Admin (TPO) Dashboard
- Cross-company placement analytics (branch-wise, CGPA-band placement rates).
- Fairness and bias dashboard monitoring shortlisting rates across branches.
- Searchable immutable audit trail.
