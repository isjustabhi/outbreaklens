"""OutbreakLens FastAPI server."""
import os
import uuid
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from database import (
    get_reports,
    get_community_risks,
    get_external_data,
    ensure_indexes,
    ping,
)
from models import ReportCreate
from ai_engine import assess_risk

load_dotenv()

app = FastAPI(
    title="OutbreakLens API",
    description="Participatory surveillance risk platform for Arizona",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# -------- helpers --------

def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip MongoDB _id and convert datetimes to ISO strings."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


def _level_from_score(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "elevated"
    if score >= 20:
        return "moderate"
    return "low"


# -------- lifecycle --------

@app.on_event("startup")
async def on_startup():
    try:
        ok = await ping()
        if ok:
            await ensure_indexes()
            print("[startup] MongoDB connected and indexes ensured.")
        else:
            print("[startup] WARNING: MongoDB ping failed. API will still serve, but DB ops will error.")
    except Exception as e:
        print(f"[startup] DB init error: {e}")


# -------- root + health --------

@app.get("/")
async def root():
    return {
        "name": "OutbreakLens API",
        "tagline": "Spot the Spark Before It Becomes a Fire",
        "status": "online",
    }


@app.get("/api/health")
async def health():
    db_ok = await ping()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "ai": "configured" if os.getenv("OPENAI_API_KEY", "").startswith("sk-") and not os.getenv("OPENAI_API_KEY", "").startswith("sk-your") else "fallback_heuristic",
    }


# -------- reports --------

@app.post("/api/reports")
async def submit_report(report: ReportCreate):
    """Submit a new symptom report; runs the AI risk assessment and stores everything."""
    try:
        # Pull recent external context (CDC alerts + weather) to feed the AI
        external = get_external_data()
        ctx_cursor = external.find({}).limit(10)
        external_context = [_serialize(d) async for d in ctx_cursor]

        report_dict = report.model_dump()
        risk = await assess_risk(report_dict, external_context)

        report_doc = {
            "report_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow(),
            "demographics": report_dict["demographics"],
            "symptoms": report_dict["symptoms"],
            "exposure": report_dict["exposure"],
            "risk_assessment": risk,
            "created_at": datetime.utcnow(),
        }

        reports = get_reports()
        await reports.insert_one(report_doc)

        return {
            "success": True,
            "report_id": report_doc["report_id"],
            "timestamp": report_doc["timestamp"].isoformat(),
            "risk_assessment": risk,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {e}")


@app.get("/api/reports")
async def list_reports(
    county: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(200, ge=1, le=1000),
):
    """List recent reports, optionally filtered by county."""
    try:
        reports = get_reports()
        query: Dict[str, Any] = {}
        if county:
            query["demographics.county"] = county
        if days:
            cutoff = datetime.utcnow() - timedelta(days=days)
            query["created_at"] = {"$gte": cutoff}

        cursor = reports.find(query).sort("created_at", -1).limit(limit)
        docs = [_serialize(d) async for d in cursor]
        return {"count": len(docs), "reports": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/risk-assess")
async def risk_assess(report: ReportCreate):
    """Run the AI risk assessment WITHOUT persisting the report."""
    try:
        external = get_external_data()
        ctx_cursor = external.find({}).limit(10)
        external_context = [_serialize(d) async for d in ctx_cursor]
        risk = await assess_risk(report.model_dump(), external_context)
        return {"risk_assessment": risk}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- community --------

@app.get("/api/community/{county}")
async def community_risk(county: str):
    """Return aggregated community risk for a county."""
    try:
        reports = get_reports()
        community = get_community_risks()

        cached = await community.find_one({"county": county})
        cached_doc = _serialize(cached) if cached else None

        # Live aggregation from recent reports
        cutoff = datetime.utcnow() - timedelta(days=30)
        cursor = reports.find({
            "demographics.county": county,
            "created_at": {"$gte": cutoff},
        })
        recent = [d async for d in cursor]

        total = len(recent)
        avg_score = (
            sum(r.get("risk_assessment", {}).get("risk_score", 0) for r in recent) / total
            if total else 0.0
        )

        symptom_counter: Counter = Counter()
        for r in recent:
            for k, v in (r.get("symptoms") or {}).items():
                if v:
                    symptom_counter[k] += 1

        dominant = [s for s, _ in symptom_counter.most_common(5)]
        risk_level = _level_from_score(avg_score)

        return {
            "county": county,
            "total_reports": total,
            "avg_risk_score": round(avg_score, 1),
            "dominant_symptoms": dominant,
            "risk_level": risk_level,
            "ai_summary": (cached_doc or {}).get("ai_summary", "No precomputed summary available."),
            "alert_active": (cached_doc or {}).get("alert_active", risk_level in ("high", "critical", "elevated")),
            "radar": _radar_for_reports(recent),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/community")
async def list_community_risks():
    """List all community risk profiles (one per county)."""
    try:
        community = get_community_risks()
        cursor = community.find({})
        docs = [_serialize(d) async for d in cursor]
        return {"count": len(docs), "communities": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _radar_for_reports(recent: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compute a 6-axis radar profile for a county."""
    if not recent:
        return [
            {"axis": "Respiratory", "value": 0},
            {"axis": "GI", "value": 0},
            {"axis": "Vector-Borne", "value": 0},
            {"axis": "Travel", "value": 0},
            {"axis": "Environmental", "value": 0},
            {"axis": "Crowding", "value": 0},
        ]
    n = len(recent)
    resp = sum(1 for r in recent if any(r.get("symptoms", {}).get(k) for k in ("cough", "sore_throat", "difficulty_breathing", "fever")))
    gi = sum(1 for r in recent if any(r.get("symptoms", {}).get(k) for k in ("nausea_vomiting", "diarrhea")))
    vector = sum(1 for r in recent if r.get("exposure", {}).get("animal_exposure") == "mosquito_bites")
    travel = sum(1 for r in recent if r.get("exposure", {}).get("recent_travel") in ("domestic", "international"))
    env = sum(1 for r in recent if r.get("exposure", {}).get("outdoor_activity_hours", 0) >= 5)
    crowd = sum(1 for r in recent if r.get("exposure", {}).get("crowded_settings"))

    def pct(x):
        return round(100.0 * x / n, 1)

    return [
        {"axis": "Respiratory", "value": pct(resp)},
        {"axis": "GI", "value": pct(gi)},
        {"axis": "Vector-Borne", "value": pct(vector)},
        {"axis": "Travel", "value": pct(travel)},
        {"axis": "Environmental", "value": pct(env)},
        {"axis": "Crowding", "value": pct(crowd)},
    ]


# -------- dashboard --------

@app.get("/api/dashboard")
async def dashboard():
    """Statewide rollup for the home tab."""
    try:
        reports = get_reports()
        external = get_external_data()

        cursor = reports.find({}).sort("created_at", -1).limit(2000)
        all_reports = [d async for d in cursor]

        total = len(all_reports)
        active_alerts = 0
        avg_score = 0.0
        county_counts: Counter = Counter()
        county_scores: Dict[str, List[float]] = defaultdict(list)
        county_symptoms: Dict[str, Counter] = defaultdict(Counter)
        symptom_counter: Counter = Counter()

        for r in all_reports:
            ra = r.get("risk_assessment", {}) or {}
            score = float(ra.get("risk_score", 0))
            avg_score += score
            if ra.get("alert_flags"):
                active_alerts += 1
            cnty = (r.get("demographics") or {}).get("county", "Unknown")
            county_counts[cnty] += 1
            county_scores[cnty].append(score)
            for k, v in (r.get("symptoms") or {}).items():
                if v:
                    symptom_counter[k] += 1
                    county_symptoms[cnty][k] += 1

        avg_score = avg_score / total if total else 0
        statewide_level = _level_from_score(avg_score)

        # Top 5 symptoms
        top_symptoms = [
            {"symptom": s, "count": c}
            for s, c in symptom_counter.most_common(5)
        ]

        # 7-day trend for top 5 symptoms
        trend_days = 7
        trend: List[Dict[str, Any]] = []
        today = datetime.utcnow().date()
        for i in range(trend_days - 1, -1, -1):
            d = today - timedelta(days=i)
            day_label = d.strftime("%b %d")
            day_entry = {"date": day_label}
            day_start = datetime.combine(d, datetime.min.time())
            day_end = day_start + timedelta(days=1)
            for sym in [t["symptom"] for t in top_symptoms]:
                day_entry[sym] = 0
            for r in all_reports:
                t = r.get("created_at")
                if not isinstance(t, datetime):
                    continue
                if not (day_start <= t < day_end):
                    continue
                for sym in [t2["symptom"] for t2 in top_symptoms]:
                    if (r.get("symptoms") or {}).get(sym):
                        day_entry[sym] += 1
            trend.append(day_entry)

        # County breakdown
        county_breakdown = []
        for cnty, count in county_counts.most_common():
            scores = county_scores[cnty]
            avg = sum(scores) / len(scores) if scores else 0
            top_sym = (county_symptoms[cnty].most_common(1) or [(None, 0)])[0][0]
            county_breakdown.append({
                "county": cnty,
                "reports": count,
                "avg_risk_score": round(avg, 1),
                "risk_level": _level_from_score(avg),
                "top_symptom": top_sym,
            })

        # Recent alerts from external_data
        alerts_cursor = external.find({"data_type": {"$in": ["disease_alert", "travel_advisory"]}}).sort("fetched_at", -1).limit(6)
        recent_alerts = [_serialize(a) async for a in alerts_cursor]

        return {
            "total_reports": total,
            "active_alerts": active_alerts,
            "statewide_risk_level": statewide_level,
            "statewide_avg_score": round(avg_score, 1),
            "counties_monitored": len(county_counts),
            "top_symptoms": top_symptoms,
            "symptom_trends": trend,
            "county_breakdown": county_breakdown,
            "recent_alerts": recent_alerts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- external --------

@app.get("/api/external/weather")
async def external_weather():
    try:
        external = get_external_data()
        cursor = external.find({"data_type": "weather"}).sort("fetched_at", -1)
        docs = [_serialize(d) async for d in cursor]
        return {"count": len(docs), "weather": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/external/alerts")
async def external_alerts():
    try:
        external = get_external_data()
        cursor = external.find({"data_type": {"$in": ["disease_alert", "travel_advisory"]}}).sort("fetched_at", -1)
        docs = [_serialize(d) async for d in cursor]
        return {"count": len(docs), "alerts": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
