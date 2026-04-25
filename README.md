# 🔭 OutbreakLens

> **Spot the Spark Before It Becomes a Fire**

An AI-powered participatory surveillance risk platform built for **Hack Arizona 2026 — Track 2: Participatory Surveillance Risk Challenge**.

Arizona residents self-report symptoms; OutbreakLens enriches each report with weather, travel, and CDC alert context, then uses **GPT-4o** to generate individual and community risk profiles for emerging infectious disease threats. Fully aligned with **One Health** principles (human + animal + environment signals) and tuned to Arizona's actual epidemiology — Valley Fever, West Nile, Dengue (border), seasonal flu, COVID-19, Norovirus, Hantavirus, Rocky Mountain Spotted Fever.

---

## 🧬 Architecture

```
React + Vite + Tailwind  ──►  FastAPI (async)  ──►  MongoDB (Atlas or local)
                                    │
                                    ├──► GPT-4o risk engine
                                    │       └─ deterministic heuristic fallback
                                    │           (works WITHOUT an OpenAI key)
                                    │
                                    └──► External enrichment
                                          ├── CDC alerts
                                          ├── ADHS county alerts
                                          └── Weather → vector activity
                                                  ↓
                                          Risk profile + community rollup
                                                  ↓
                                          Human-in-the-loop epi review
```

---

## 🚀 Quick start

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **MongoDB** — either:
  - **Local** — install [MongoDB Community Edition](https://www.mongodb.com/try/download/community) and run `mongod`, or
  - **Cloud** — create a free **[MongoDB Atlas M0](https://www.mongodb.com/cloud/atlas)** cluster and copy the connection string
- **OpenAI API key** *(optional — the app works without one via a built-in heuristic fallback)*

### 1. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — paste your OPENAI_API_KEY (optional) and MONGODB_URI

# seed the database (one time)
python seed.py

# run the API
uvicorn main:app --reload --port 3001
```

You should see `[startup] MongoDB connected and indexes ensured.` and Uvicorn listening on `http://localhost:3001`.

### 2. Frontend
```bash
# new terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — Dashboard loads immediately with seeded Arizona data.

---

## 🐳 Docker (optional)

```bash
docker compose up --build
```

This brings up `mongo`, `backend` (port 3001), and `frontend` (port 5173) together. Set `OPENAI_API_KEY` in `backend/.env` first.

---

## 🧪 Demo scenarios baked into the seed data

| County | Scenario | Why it matters |
|---|---|---|
| **Pima** | Respiratory cluster (flu / RSV) — 12 reports | Seasonal respiratory uptick demonstration |
| **Maricopa** | Mosquito-borne febrile cluster — 8 reports | West Nile during monsoon season |
| **Yuma** | Acute GI symptoms with non-municipal water | Possible water-borne outbreak signal |
| **Coconino** | Returned international travelers with fever | Border-region dengue surveillance |
| **Pima/Maricopa/Cochise** | Persistent cough + heavy outdoor exposure | Valley Fever (Arizona's signature pathogen) |

Plus a baseline of mild reports across remaining counties for realistic noise.

---

## 🌐 API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service + DB + AI status |
| `POST` | `/api/reports` | Submit a new symptom report (returns AI risk assessment) |
| `GET` | `/api/reports?county=Pima&days=7` | List recent reports |
| `POST` | `/api/risk-assess` | Run risk assessment without persisting |
| `GET` | `/api/community/{county}` | Community risk profile for one county |
| `GET` | `/api/community` | All county summaries |
| `GET` | `/api/dashboard` | Statewide rollup (stats, trends, alerts) |
| `GET` | `/api/external/weather` | Seeded weather data |
| `GET` | `/api/external/alerts` | Seeded CDC + ADHS alerts |

The interactive OpenAPI docs are at **http://localhost:3001/docs**.

---

## 🧠 The AI risk engine

`backend/ai_engine.py` calls GPT-4o with a strict JSON schema:

```json
{
  "riskScore": 0-100,
  "riskLevel": "low|moderate|elevated|high|critical",
  "primaryConcerns": [{ "pathogen": "...", "likelihood": "...", "reasoning": "..." }],
  "contributingFactors": [{ "factor": "...", "impact": "increases|decreases", "weight": "..." }],
  "recommendations": ["..."],
  "alertFlags": ["..."],
  "arizonaContext": "..."
}
```

If `OPENAI_API_KEY` is missing or invalid, the engine **automatically falls back** to a transparent rule-based scoring function so the demo always runs.

---

## 📋 Required challenge artifacts

- ✅ **Model Card** — see the *About* tab in the frontend (model, purpose, inputs, outputs, limitations, bias, performance evaluation)
- ✅ **Human-in-the-Loop** — every "high"/"critical" alert is queued for epidemiologist review before any community-facing broadcast (documented in *About*, surfaced in the Community Map recommendations)
- ✅ **Arizona-specific deployment** — pathogen watchlist tuned to AZ epidemiology; severity thresholds calibrated to ADHS conventions; Spanish-language UI on the roadmap for border communities
- ✅ **Medical disclaimer** — surfaced on the Report tab and About tab
- ✅ **One Health framing** — every form captures human, animal, and environmental signals

---

## 🚢 Deployment

- **Frontend** → Vercel (`vercel deploy` from `frontend/`); set `VITE_API_URL` to your backend URL
- **Backend** → Render or Railway (`uvicorn main:app --host 0.0.0.0 --port $PORT`)
- **Database** → MongoDB Atlas free M0 cluster

---

## 📁 Project layout

```
outbreaklens/
├── backend/
│   ├── main.py             FastAPI app + all routes
│   ├── models.py           Pydantic schemas
│   ├── database.py         MongoDB connection
│   ├── ai_engine.py        GPT-4o + heuristic fallback
│   ├── seed.py             Seed script with realistic AZ scenarios
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html          Google Fonts + meta
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx        React mount
│       ├── index.css       Tailwind + futuristic theme
│       └── App.jsx         Single-file frontend (all 4 tabs)
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## ⚖️ Disclaimer

OutbreakLens is a prototype surveillance tool. It does not provide medical diagnoses. Consult a healthcare provider for medical concerns. Call **911** for emergencies.
