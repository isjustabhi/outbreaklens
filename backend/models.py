"""Pydantic models for request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class Demographics(BaseModel):
    age_group: str
    sex: str
    zip_code: str
    county: str


class Symptoms(BaseModel):
    fever: bool = False
    cough: bool = False
    sore_throat: bool = False
    body_aches: bool = False
    headache: bool = False
    fatigue: bool = False
    nausea_vomiting: bool = False
    diarrhea: bool = False
    rash: bool = False
    difficulty_breathing: bool = False
    loss_taste_smell: bool = False


class Exposure(BaseModel):
    recent_travel: str = "none"
    travel_destination: Optional[str] = None
    animal_exposure: str = "none"
    outdoor_activity_hours: int = 0
    crowded_settings: bool = False
    healthcare_worker: bool = False
    household_sick: bool = False
    water_source: str = "municipal"


class ReportCreate(BaseModel):
    demographics: Demographics
    symptoms: Symptoms
    exposure: Exposure


class PrimaryConcern(BaseModel):
    pathogen: str
    likelihood: str
    reasoning: str


class ContributingFactor(BaseModel):
    factor: str
    impact: str
    weight: str


class RiskAssessment(BaseModel):
    risk_score: float
    risk_level: str
    primary_concerns: List[Dict[str, Any]] = Field(default_factory=list)
    contributing_factors: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    alert_flags: List[str] = Field(default_factory=list)
    arizona_context: str = ""


class ReportResponse(BaseModel):
    report_id: str
    timestamp: datetime
    demographics: Demographics
    symptoms: Symptoms
    exposure: Exposure
    risk_assessment: RiskAssessment


class CommunityRiskResponse(BaseModel):
    county: str
    zip_code: Optional[str] = None
    date: str
    total_reports: int
    avg_risk_score: float
    dominant_symptoms: List[str]
    risk_level: str
    ai_summary: str
    alert_active: bool


class DashboardResponse(BaseModel):
    total_reports: int
    active_alerts: int
    statewide_risk_level: str
    counties_monitored: int
    top_symptoms: List[Dict[str, Any]]
    symptom_trends: List[Dict[str, Any]]
    county_breakdown: List[Dict[str, Any]]
    recent_alerts: List[Dict[str, Any]]


class ExternalDataResponse(BaseModel):
    source: str
    data_type: str
    region: str
    value: Dict[str, Any]
    fetched_at: datetime
