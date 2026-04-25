"""GPT-4o risk assessment engine for OutbreakLens."""
import os
import json
import openai
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are OutbreakLens, an AI epidemiological risk analyst for Arizona's participatory surveillance system. Given a self-reported symptom profile and contextual data, generate an individual risk assessment for emerging infectious disease threats.

Use One Health principles — consider human, animal, and environmental factors. Reference real pathogens relevant to Arizona: Valley Fever (Coccidioidomycosis), West Nile Virus, Hantavirus, Dengue (border region), seasonal influenza, COVID-19 variants, Norovirus, Rocky Mountain Spotted Fever.

Respond ONLY with valid JSON:
{
  "riskScore": <0-100>,
  "riskLevel": "low|moderate|elevated|high|critical",
  "primaryConcerns": [
    { "pathogen": "name", "likelihood": "low|moderate|high", "reasoning": "1-2 sentences" }
  ],
  "contributingFactors": [
    { "factor": "description", "impact": "increases|decreases", "weight": "high|medium|low" }
  ],
  "recommendations": [
    "specific actionable recommendation 1",
    "specific actionable recommendation 2",
    "specific actionable recommendation 3"
  ],
  "alertFlags": ["any urgent flags that should trigger community alerts"],
  "arizonaContext": "1-2 sentences about how this relates to current Arizona health landscape"
}"""


def _to_snake_case_assessment(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Convert camelCase keys from GPT to snake_case for our schema."""
    return {
        "risk_score": float(parsed.get("riskScore", 0)),
        "risk_level": str(parsed.get("riskLevel", "low")).lower(),
        "primary_concerns": parsed.get("primaryConcerns", []),
        "contributing_factors": parsed.get("contributingFactors", []),
        "recommendations": parsed.get("recommendations", []),
        "alert_flags": parsed.get("alertFlags", []),
        "arizona_context": parsed.get("arizonaContext", ""),
    }


def _heuristic_fallback(report_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic fallback if OPENAI_API_KEY is missing or the API errors.
    Keeps the demo running even without a key.
    """
    symptoms = report_data.get("symptoms", {})
    exposure = report_data.get("exposure", {})
    demo = report_data.get("demographics", {})

    symptom_count = sum(1 for v in symptoms.values() if v is True)
    score = symptom_count * 8

    concerns: List[Dict[str, str]] = []
    factors: List[Dict[str, str]] = []
    flags: List[str] = []
    recs: List[str] = []

    # Respiratory cluster
    if symptoms.get("fever") and symptoms.get("cough"):
        score += 20
        concerns.append({
            "pathogen": "Influenza A/B",
            "likelihood": "moderate",
            "reasoning": "Fever combined with cough is a hallmark of seasonal influenza, especially during AZ flu season.",
        })
        if symptoms.get("difficulty_breathing"):
            score += 15
            concerns.append({
                "pathogen": "COVID-19",
                "likelihood": "moderate",
                "reasoning": "Respiratory distress with fever warrants COVID-19 consideration.",
            })
            flags.append("Respiratory distress reported — recommend immediate clinical evaluation.")
        recs.append("Stay home, hydrate, and consider rapid flu/COVID testing.")

    # Vector-borne signals
    if exposure.get("animal_exposure") == "mosquito_bites" and symptoms.get("fever"):
        score += 18
        concerns.append({
            "pathogen": "West Nile Virus",
            "likelihood": "moderate",
            "reasoning": "Mosquito exposure with fever is a classic West Nile presentation in Arizona's monsoon season.",
        })
        if exposure.get("travel_destination", "") and "mexico" in str(exposure.get("travel_destination")).lower():
            concerns.append({
                "pathogen": "Dengue",
                "likelihood": "moderate",
                "reasoning": "Recent travel to Mexico border region elevates dengue risk.",
            })
        recs.append("Use EPA-registered mosquito repellent and report standing water nearby.")

    # GI / water-borne
    if symptoms.get("nausea_vomiting") or symptoms.get("diarrhea"):
        score += 12
        if exposure.get("water_source") in ("well", "other"):
            score += 8
            concerns.append({
                "pathogen": "Norovirus / Bacterial gastroenteritis",
                "likelihood": "moderate",
                "reasoning": "GI symptoms with non-municipal water exposure suggest possible water-borne illness.",
            })
        recs.append("Hydrate aggressively with electrolytes; avoid food prep for others until 48h symptom-free.")

    # Valley Fever (Arizona-specific)
    if symptoms.get("cough") and symptoms.get("fatigue") and exposure.get("outdoor_activity_hours", 0) >= 5:
        score += 10
        concerns.append({
            "pathogen": "Valley Fever (Coccidioidomycosis)",
            "likelihood": "moderate",
            "reasoning": "Persistent cough with fatigue and outdoor exposure in AZ is a classic Valley Fever presentation.",
        })
        recs.append("Request a coccidioidomycosis (Valley Fever) test if cough persists >7 days.")

    # Contributing factors
    if exposure.get("household_sick"):
        factors.append({"factor": "Household member is sick", "impact": "increases", "weight": "high"})
    if exposure.get("crowded_settings"):
        factors.append({"factor": "Recent crowded settings exposure", "impact": "increases", "weight": "medium"})
    if exposure.get("healthcare_worker"):
        factors.append({"factor": "Healthcare worker occupation", "impact": "increases", "weight": "medium"})
    if exposure.get("recent_travel") in ("domestic", "international"):
        factors.append({"factor": f"Recent {exposure.get('recent_travel')} travel", "impact": "increases", "weight": "medium"})
    if demo.get("age_group") == "55+":
        factors.append({"factor": "Age 55+ (higher complication risk)", "impact": "increases", "weight": "medium"})
    if symptom_count <= 1:
        factors.append({"factor": "Limited symptom profile", "impact": "decreases", "weight": "medium"})

    if not recs:
        recs.append("Monitor symptoms; seek care if they worsen or persist beyond 72 hours.")
    recs.append("Practice respiratory hygiene and limit close contact with vulnerable individuals.")
    recs.append("Re-submit a report if new symptoms emerge so the community signal stays current.")

    score = max(0, min(100, score))
    if score >= 80:
        level = "critical"
    elif score >= 60:
        level = "high"
    elif score >= 40:
        level = "elevated"
    elif score >= 20:
        level = "moderate"
    else:
        level = "low"

    az_context = (
        f"Reports from {demo.get('county', 'your county')} are aggregated with statewide data. "
        "Arizona's current surveillance window includes seasonal flu, Valley Fever, and monsoon-driven vector-borne risks."
    )

    return {
        "risk_score": float(score),
        "risk_level": level,
        "primary_concerns": concerns[:4],
        "contributing_factors": factors[:6],
        "recommendations": recs[:5],
        "alert_flags": flags,
        "arizona_context": az_context,
    }


async def assess_risk(report_data: Dict[str, Any], external_context: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Call GPT-4o for an individual risk assessment. Falls back to a deterministic
    heuristic if no API key is configured or the call fails — the demo never breaks.
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key.startswith("sk-your"):
        return _heuristic_fallback(report_data)

    try:
        client = openai.AsyncOpenAI(api_key=api_key)
        user_prompt = (
            "Self-reported symptom profile and context:\n"
            f"{json.dumps(report_data, indent=2, default=str)}\n\n"
            "External context (CDC alerts, weather, regional intel):\n"
            f"{json.dumps(external_context, indent=2, default=str)}\n\n"
            "Generate the JSON risk assessment now."
        )
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return _to_snake_case_assessment(parsed)
    except Exception as e:
        # Safety net: never break the demo
        print(f"[ai_engine] OpenAI call failed, falling back to heuristic: {e}")
        return _heuristic_fallback(report_data)
