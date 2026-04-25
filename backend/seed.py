"""
Seed MongoDB with sample reports, community risk profiles, and external data.
Run once: python seed.py
"""
import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

ARIZONA_COUNTIES = [
    "Pima", "Maricopa", "Coconino", "Yuma", "Cochise",
    "Santa Cruz", "Navajo", "Apache",
]

ZIP_BY_COUNTY = {
    "Pima": ["85719", "85705", "85716", "85745"],
    "Maricopa": ["85003", "85042", "85254", "85286"],
    "Coconino": ["86001", "86004", "86046"],
    "Yuma": ["85364", "85365", "85367"],
    "Cochise": ["85607", "85603", "85650"],
    "Santa Cruz": ["85621", "85648"],
    "Navajo": ["86025", "86047"],
    "Apache": ["85920", "86505"],
}

AGE_GROUPS = ["0-17", "18-34", "35-54", "55+"]
SEXES = ["Female", "Male", "Non-binary", "Prefer not to say"]


def _empty_symptoms() -> Dict[str, bool]:
    return {
        "fever": False, "cough": False, "sore_throat": False,
        "body_aches": False, "headache": False, "fatigue": False,
        "nausea_vomiting": False, "diarrhea": False, "rash": False,
        "difficulty_breathing": False, "loss_taste_smell": False,
    }


def _empty_exposure() -> Dict[str, Any]:
    return {
        "recent_travel": "none",
        "travel_destination": None,
        "animal_exposure": "none",
        "outdoor_activity_hours": 0,
        "crowded_settings": False,
        "healthcare_worker": False,
        "household_sick": False,
        "water_source": "municipal",
    }


def _level_from_score(score: float) -> str:
    if score >= 80: return "critical"
    if score >= 60: return "high"
    if score >= 40: return "elevated"
    if score >= 20: return "moderate"
    return "low"


def _make_report(
    county: str,
    scenario: str,
    days_ago: int,
) -> Dict[str, Any]:
    """Make a single sample report driven by a scenario."""
    symptoms = _empty_symptoms()
    exposure = _empty_exposure()
    risk_score = 10
    primary_concerns: List[Dict[str, str]] = []
    factors: List[Dict[str, str]] = []
    flags: List[str] = []
    recs: List[str] = []

    if scenario == "respiratory_pima":
        # Pima respiratory cluster: flu / RSV
        symptoms["fever"] = True
        symptoms["cough"] = True
        symptoms["body_aches"] = random.random() > 0.3
        symptoms["fatigue"] = random.random() > 0.2
        symptoms["sore_throat"] = random.random() > 0.5
        if random.random() > 0.7:
            symptoms["difficulty_breathing"] = True
            flags.append("Respiratory distress reported — recommend clinical evaluation.")
        exposure["crowded_settings"] = random.random() > 0.5
        exposure["household_sick"] = random.random() > 0.5
        risk_score = random.randint(55, 78)
        primary_concerns = [
            {"pathogen": "Influenza A/B", "likelihood": "high",
             "reasoning": "Fever + cough + body aches in a county with active respiratory cluster."},
            {"pathogen": "RSV", "likelihood": "moderate",
             "reasoning": "Concurrent RSV circulation reported in southern Arizona."},
        ]
        factors = [
            {"factor": "Active respiratory cluster in Pima County", "impact": "increases", "weight": "high"},
            {"factor": "Household exposure", "impact": "increases", "weight": "medium"},
        ]
        recs = [
            "Stay home until at least 24 hours fever-free without medication.",
            "Get tested for flu and COVID-19 within 48 hours of symptom onset.",
            "Mask around vulnerable household members.",
        ]

    elif scenario == "gi_yuma":
        # Yuma waterborne GI
        symptoms["nausea_vomiting"] = True
        symptoms["diarrhea"] = True
        symptoms["fatigue"] = random.random() > 0.4
        symptoms["fever"] = random.random() > 0.6
        exposure["water_source"] = random.choice(["well", "other"])
        exposure["outdoor_activity_hours"] = random.randint(2, 8)
        risk_score = random.randint(40, 65)
        primary_concerns = [
            {"pathogen": "Norovirus", "likelihood": "moderate",
             "reasoning": "Acute GI symptoms in a region without confirmed bacterial outbreak."},
            {"pathogen": "Bacterial gastroenteritis", "likelihood": "moderate",
             "reasoning": "Non-municipal water exposure raises bacterial GI suspicion."},
        ]
        factors = [
            {"factor": "Non-municipal water source", "impact": "increases", "weight": "high"},
        ]
        recs = [
            "Hydrate aggressively with oral rehydration solution.",
            "Avoid food prep for others until 48 hours symptom-free.",
            "Have well water tested if symptoms recur after recovery.",
        ]

    elif scenario == "vector_maricopa":
        # Maricopa mosquito-borne
        symptoms["fever"] = True
        symptoms["headache"] = random.random() > 0.3
        symptoms["body_aches"] = random.random() > 0.4
        symptoms["rash"] = random.random() > 0.7
        exposure["animal_exposure"] = "mosquito_bites"
        exposure["outdoor_activity_hours"] = random.randint(6, 20)
        risk_score = random.randint(50, 72)
        primary_concerns = [
            {"pathogen": "West Nile Virus", "likelihood": "moderate",
             "reasoning": "Fever with mosquito exposure during AZ monsoon mosquito activity peak."},
        ]
        factors = [
            {"factor": "Heavy mosquito exposure during monsoon season", "impact": "increases", "weight": "high"},
            {"factor": "Extended outdoor activity hours", "impact": "increases", "weight": "medium"},
        ]
        recs = [
            "Apply EPA-registered mosquito repellent (DEET 20-30% or picaridin).",
            "Eliminate standing water on your property.",
            "Seek care immediately for severe headache, stiff neck, or confusion.",
        ]

    elif scenario == "travel_coconino":
        # Coconino returned traveler
        symptoms["fever"] = True
        symptoms["fatigue"] = True
        symptoms["headache"] = random.random() > 0.4
        symptoms["body_aches"] = random.random() > 0.5
        exposure["recent_travel"] = "international"
        exposure["travel_destination"] = random.choice([
            "Mexico (Sonora)", "Guatemala", "Brazil", "India",
        ])
        risk_score = random.randint(45, 68)
        primary_concerns = [
            {"pathogen": "Dengue", "likelihood": "moderate",
             "reasoning": "Returned traveler from a dengue-endemic region with febrile illness."},
            {"pathogen": "Influenza", "likelihood": "moderate",
             "reasoning": "Travel-associated respiratory infection cannot be ruled out."},
        ]
        factors = [
            {"factor": f"Recent international travel ({exposure['travel_destination']})", "impact": "increases", "weight": "high"},
        ]
        recs = [
            "Notify your provider of travel history before any clinical visit.",
            "Avoid NSAIDs (e.g., ibuprofen) until dengue is ruled out.",
            "Self-isolate for 7 days from symptom onset.",
        ]

    elif scenario == "valley_fever":
        # Valley Fever — outdoor exposure, persistent cough
        symptoms["cough"] = True
        symptoms["fatigue"] = True
        symptoms["fever"] = random.random() > 0.5
        symptoms["body_aches"] = random.random() > 0.6
        exposure["outdoor_activity_hours"] = random.randint(8, 25)
        risk_score = random.randint(38, 58)
        primary_concerns = [
            {"pathogen": "Valley Fever (Coccidioidomycosis)", "likelihood": "moderate",
             "reasoning": "Persistent cough with fatigue and significant outdoor exposure in Arizona."},
        ]
        factors = [
            {"factor": "Heavy outdoor/dust exposure", "impact": "increases", "weight": "high"},
        ]
        recs = [
            "Request a coccidioidomycosis test if cough persists >7 days.",
            "Wear N95 during dust-generating outdoor activities.",
        ]

    else:  # baseline / mild
        if random.random() > 0.5:
            symptoms["fatigue"] = True
        if random.random() > 0.6:
            symptoms["headache"] = True
        risk_score = random.randint(8, 28)
        primary_concerns = [
            {"pathogen": "Common cold / non-specific viral", "likelihood": "low",
             "reasoning": "Mild non-specific symptoms without contextual risk amplifiers."},
        ]
        factors = [{"factor": "Limited symptom profile", "impact": "decreases", "weight": "medium"}]
        recs = ["Monitor symptoms and rest. Seek care if symptoms worsen or persist beyond 72 hours."]

    risk_level = _level_from_score(risk_score)

    age_group = random.choice(AGE_GROUPS)
    sex = random.choice(SEXES)
    zip_code = random.choice(ZIP_BY_COUNTY[county])

    timestamp = datetime.utcnow() - timedelta(
        days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59)
    )

    return {
        "report_id": str(uuid.uuid4()),
        "timestamp": timestamp,
        "demographics": {
            "age_group": age_group,
            "sex": sex,
            "zip_code": zip_code,
            "county": county,
        },
        "symptoms": symptoms,
        "exposure": exposure,
        "risk_assessment": {
            "risk_score": float(risk_score),
            "risk_level": risk_level,
            "primary_concerns": primary_concerns,
            "contributing_factors": factors,
            "recommendations": recs,
            "alert_flags": flags,
            "arizona_context": (
                f"Recent reports from {county} are part of Arizona's active surveillance window. "
                "One Health monitoring tracks human, animal, and environmental signals."
            ),
        },
        "created_at": timestamp,
    }


def _build_seed_reports() -> List[Dict[str, Any]]:
    """Generate ~45 reports across the four scenarios + baseline."""
    reports: List[Dict[str, Any]] = []

    # Pima respiratory cluster — 12 reports over 7 days
    for _ in range(12):
        reports.append(_make_report("Pima", "respiratory_pima", random.randint(0, 6)))

    # Yuma GI cluster — 6 reports
    for _ in range(6):
        reports.append(_make_report("Yuma", "gi_yuma", random.randint(0, 6)))

    # Maricopa vector-borne — 8 reports
    for _ in range(8):
        reports.append(_make_report("Maricopa", "vector_maricopa", random.randint(0, 7)))

    # Coconino travel-related — 4 reports
    for _ in range(4):
        reports.append(_make_report("Coconino", "travel_coconino", random.randint(0, 6)))

    # Valley Fever scattered — 5 reports
    for _ in range(5):
        cnty = random.choice(["Pima", "Maricopa", "Cochise", "Santa Cruz"])
        reports.append(_make_report(cnty, "valley_fever", random.randint(0, 7)))

    # Baseline mild — 12 reports across remaining counties
    for _ in range(12):
        cnty = random.choice(ARIZONA_COUNTIES)
        reports.append(_make_report(cnty, "baseline", random.randint(0, 7)))

    return reports


def _build_community_summaries() -> List[Dict[str, Any]]:
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    return [
        {
            "county": "Pima",
            "zip_code": None,
            "date": today_str,
            "total_reports": 14,
            "avg_risk_score": 62.4,
            "dominant_symptoms": ["fever", "cough", "body_aches", "fatigue"],
            "risk_level": "high",
            "ai_summary": (
                "Pima County is showing a respiratory symptom cluster consistent with influenza or RSV, "
                "concentrated in the 18-34 and 55+ age bands. Several reports include household exposure, "
                "suggesting active community transmission. Recommend masking in clinical settings and "
                "amplifying flu/COVID testing access."
            ),
            "alert_active": True,
        },
        {
            "county": "Maricopa",
            "zip_code": None,
            "date": today_str,
            "total_reports": 9,
            "avg_risk_score": 58.7,
            "dominant_symptoms": ["fever", "headache", "body_aches"],
            "risk_level": "elevated",
            "ai_summary": (
                "Maricopa County reports a vector-borne signal — multiple febrile cases with mosquito "
                "exposure during the monsoon mosquito activity peak. West Nile Virus surveillance should "
                "be amplified; coordinate with vector control on standing-water mitigation."
            ),
            "alert_active": True,
        },
        {
            "county": "Yuma",
            "zip_code": None,
            "date": today_str,
            "total_reports": 7,
            "avg_risk_score": 49.2,
            "dominant_symptoms": ["nausea_vomiting", "diarrhea", "fatigue"],
            "risk_level": "elevated",
            "ai_summary": (
                "Yuma County is reporting acute GI symptoms among residents using non-municipal water "
                "sources. Norovirus and bacterial gastroenteritis are the leading hypotheses. Recommend "
                "well-water testing outreach and food-handler advisories."
            ),
            "alert_active": True,
        },
        {
            "county": "Coconino",
            "zip_code": None,
            "date": today_str,
            "total_reports": 4,
            "avg_risk_score": 51.0,
            "dominant_symptoms": ["fever", "fatigue", "headache"],
            "risk_level": "elevated",
            "ai_summary": (
                "Coconino reports include returned travelers from dengue-endemic regions. Risk to the "
                "general population remains low, but clinicians should ask about travel history and "
                "avoid empiric NSAID use until dengue is ruled out."
            ),
            "alert_active": False,
        },
        {
            "county": "Cochise",
            "zip_code": None,
            "date": today_str,
            "total_reports": 3,
            "avg_risk_score": 28.5,
            "dominant_symptoms": ["cough", "fatigue"],
            "risk_level": "moderate",
            "ai_summary": (
                "Cochise County signal is currently low-to-moderate. A small number of persistent cough "
                "reports with outdoor exposure suggest watching for Valley Fever signal growth."
            ),
            "alert_active": False,
        },
        {
            "county": "Santa Cruz",
            "zip_code": None,
            "date": today_str,
            "total_reports": 2,
            "avg_risk_score": 24.0,
            "dominant_symptoms": ["fatigue", "headache"],
            "risk_level": "moderate",
            "ai_summary": (
                "Santa Cruz reports remain limited. Cross-border health intelligence (Sonora) should be "
                "monitored given proximity to dengue-active regions."
            ),
            "alert_active": False,
        },
        {
            "county": "Navajo",
            "zip_code": None,
            "date": today_str,
            "total_reports": 1,
            "avg_risk_score": 18.0,
            "dominant_symptoms": ["fatigue"],
            "risk_level": "low",
            "ai_summary": "No active community signal in Navajo County at this time.",
            "alert_active": False,
        },
        {
            "county": "Apache",
            "zip_code": None,
            "date": today_str,
            "total_reports": 1,
            "avg_risk_score": 15.0,
            "dominant_symptoms": ["headache"],
            "risk_level": "low",
            "ai_summary": "No active community signal in Apache County at this time.",
            "alert_active": False,
        },
    ]


def _build_external_data() -> List[Dict[str, Any]]:
    now = datetime.utcnow()
    return [
        {
            "source": "cdc",
            "data_type": "travel_advisory",
            "region": "Mexico — Sonora",
            "value": {
                "advisory": "Dengue cases rising in Northern Mexico border region. Travelers should use mosquito repellent and stay in screened/AC accommodations.",
                "severity": "moderate",
            },
            "fetched_at": now,
        },
        {
            "source": "cdc",
            "data_type": "disease_alert",
            "region": "Arizona",
            "value": {
                "advisory": "Seasonal influenza activity is elevated across the Southwest. Vaccination recommended for all eligible residents.",
                "severity": "moderate",
            },
            "fetched_at": now - timedelta(hours=6),
        },
        {
            "source": "azdhs",
            "data_type": "disease_alert",
            "region": "Maricopa County",
            "value": {
                "advisory": "West Nile Virus activity confirmed in mosquito surveillance pools. Residents urged to eliminate standing water.",
                "severity": "high",
            },
            "fetched_at": now - timedelta(hours=12),
        },
        {
            "source": "azdhs",
            "data_type": "disease_alert",
            "region": "Pima County",
            "value": {
                "advisory": "Respiratory illness uptick observed in school-age and elderly populations. Increased flu/RSV testing recommended.",
                "severity": "moderate",
            },
            "fetched_at": now - timedelta(hours=18),
        },
        {
            "source": "weather",
            "data_type": "weather",
            "region": "Phoenix, AZ",
            "value": {
                "temperature_f": 92,
                "humidity_pct": 38,
                "mosquito_activity": "High",
                "notes": "Monsoon-driven humidity is supporting elevated mosquito populations.",
            },
            "fetched_at": now,
        },
        {
            "source": "weather",
            "data_type": "weather",
            "region": "Tucson, AZ",
            "value": {
                "temperature_f": 88,
                "humidity_pct": 32,
                "mosquito_activity": "Medium",
                "notes": "Dust events possible — increased Valley Fever risk for outdoor workers.",
            },
            "fetched_at": now,
        },
        {
            "source": "weather",
            "data_type": "weather",
            "region": "Flagstaff, AZ",
            "value": {
                "temperature_f": 68,
                "humidity_pct": 28,
                "mosquito_activity": "Low",
                "notes": "Cooler temps reduce vector activity in northern AZ.",
            },
            "fetched_at": now,
        },
        {
            "source": "outbreaklens",
            "data_type": "pathogen_watch",
            "region": "Arizona",
            "value": {
                "pathogens": [
                    "Influenza A/B",
                    "RSV",
                    "COVID-19",
                    "West Nile Virus",
                    "Valley Fever (Coccidioidomycosis)",
                    "Dengue (border)",
                    "Norovirus",
                ],
            },
            "fetched_at": now,
        },
    ]


async def run():
    print(f"[seed] Connecting to {MONGODB_URI}")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client["outbreaklens"]
    reports = db["reports"]
    community = db["community_risks"]
    external = db["external_data"]

    print("[seed] Clearing existing collections…")
    await reports.delete_many({})
    await community.delete_many({})
    await external.delete_many({})

    print("[seed] Inserting reports…")
    docs = _build_seed_reports()
    if docs:
        await reports.insert_many(docs)
    print(f"[seed]   inserted {len(docs)} reports")

    print("[seed] Inserting community risk profiles…")
    com_docs = _build_community_summaries()
    if com_docs:
        await community.insert_many(com_docs)
    print(f"[seed]   inserted {len(com_docs)} community summaries")

    print("[seed] Inserting external data…")
    ext_docs = _build_external_data()
    if ext_docs:
        await external.insert_many(ext_docs)
    print(f"[seed]   inserted {len(ext_docs)} external data entries")

    print("[seed] Creating indexes…")
    await reports.create_index([("demographics.county", 1)])
    await reports.create_index([("created_at", -1)])
    await reports.create_index([("report_id", 1)], unique=True)
    await community.create_index([("county", 1), ("date", -1)])
    await external.create_index([("source", 1), ("data_type", 1)])

    print("[seed] ✓ Done.")


if __name__ == "__main__":
    asyncio.run(run())
