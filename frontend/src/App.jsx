import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';

/* ============================================================
   API BASE
   ============================================================ */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const RISK_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  elevated: '#F59E0B',
  moderate: '#3B82F6',
  low: '#14B8A6',
};

const ARIZONA_COUNTIES = [
  'Pima', 'Maricopa', 'Coconino', 'Yuma', 'Cochise',
  'Santa Cruz', 'Navajo', 'Apache',
];

const SYMPTOM_LIST = [
  { key: 'fever', label: 'Fever', icon: '🌡️' },
  { key: 'cough', label: 'Cough', icon: '😷' },
  { key: 'sore_throat', label: 'Sore Throat', icon: '🗣️' },
  { key: 'body_aches', label: 'Body Aches', icon: '💪' },
  { key: 'headache', label: 'Headache', icon: '🧠' },
  { key: 'fatigue', label: 'Fatigue', icon: '😴' },
  { key: 'nausea_vomiting', label: 'Nausea / Vomiting', icon: '🤢' },
  { key: 'diarrhea', label: 'Diarrhea', icon: '💧' },
  { key: 'rash', label: 'Rash', icon: '🩹' },
  { key: 'difficulty_breathing', label: 'Difficulty Breathing', icon: '🫁' },
  { key: 'loss_taste_smell', label: 'Loss of Taste/Smell', icon: '👃' },
];

/* ============================================================
   API HELPERS
   ============================================================ */
const api = {
  async dashboard() {
    const r = await fetch(`${API_BASE}/api/dashboard`);
    if (!r.ok) throw new Error('dashboard failed');
    return r.json();
  },
  async submitReport(payload) {
    const r = await fetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('submit failed');
    return r.json();
  },
  async community(county) {
    const r = await fetch(`${API_BASE}/api/community/${encodeURIComponent(county)}`);
    if (!r.ok) throw new Error('community failed');
    return r.json();
  },
  async communities() {
    const r = await fetch(`${API_BASE}/api/community`);
    if (!r.ok) throw new Error('communities failed');
    return r.json();
  },
  async weather() {
    const r = await fetch(`${API_BASE}/api/external/weather`);
    if (!r.ok) throw new Error('weather failed');
    return r.json();
  },
  async alerts() {
    const r = await fetch(`${API_BASE}/api/external/alerts`);
    if (!r.ok) throw new Error('alerts failed');
    return r.json();
  },
};

/* ============================================================
   SMALL UTILITIES
   ============================================================ */
function classNames(...xs) { return xs.filter(Boolean).join(' '); }

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) { setVal(0); return; }
    let start = null;
    const initial = 0;
    let frame;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(initial + (target - initial) * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return val;
}

function RiskBadge({ level, size = 'md', glow = false }) {
  const color = RISK_COLORS[level] || RISK_COLORS.low;
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : size === 'lg' ? 'text-sm px-4 py-1.5' : 'text-xs px-2.5 py-1';
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider',
        sizeClass,
        glow && 'pulse-ring',
      )}
      style={{
        background: `${color}1f`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {level || 'unknown'}
    </span>
  );
}

/* ============================================================
   PARTICLE BACKGROUND
   ============================================================ */
function ParticleBg() {
  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 14,
        color: Math.random() > 0.6 ? '#F59E0B' : '#EF4444',
        opacity: 0.15 + Math.random() * 0.4,
      });
    }
    return arr;
  }, []);
  return (
    <div className="particles">
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: p.color,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar({ tab, setTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'report', label: 'Report Symptoms' },
    { id: 'community', label: 'Community Map' },
    { id: 'about', label: 'About' },
  ];
  return (
    <nav className="relative z-10 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-risk-critical to-risk-elevated flex items-center justify-center shadow-lg shadow-red-500/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <circle cx="11" cy="11" r="3" fill="white" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-risk-critical animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-risk-critical" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">OutbreakLens</h1>
            <p className="text-[11px] text-white/50 -mt-0.5">Spot the Spark Before It Becomes a Fire</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-card/60 border border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={classNames(
                'px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all',
                tab === t.id
                  ? 'bg-gradient-to-r from-risk-critical/30 to-risk-elevated/30 text-white shadow-inner'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

/* ============================================================
   STAT CARD
   ============================================================ */
function StatCard({ label, value, hint, color = '#EF4444', glow = false, icon }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  const isNum = typeof value === 'number';
  return (
    <div className={classNames(
      'glass rounded-2xl p-4 sm:p-5 relative overflow-hidden',
      glow && 'pulse-ring',
    )}>
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest text-white/50">{label}</span>
          {icon && <span className="text-lg">{icon}</span>}
        </div>
        <div className="stat-num text-3xl sm:text-4xl" style={{ color }}>
          {isNum ? Math.round(animated).toLocaleString() : value}
        </div>
        {hint && <div className="text-[11px] text-white/50 mt-1">{hint}</div>}
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD TAB
   ============================================================ */
function Dashboard({ onSelectCounty }) {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const [d, w, a] = await Promise.all([api.dashboard(), api.weather(), api.alerts()]);
        if (cancel) return;
        setData(d);
        setWeather(w.weather || []);
        setAlerts(a.alerts || []);
      } catch (e) {
        if (!cancel) setErr(e.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (loading) return <LoadingPulse label="Loading surveillance dashboard…" />;
  if (err) return <ErrorBox message={err} />;
  if (!data) return null;

  const trendKeys = (data.top_symptoms || []).map(t => t.symptom);
  const symColors = ['#EF4444', '#F59E0B', '#3B82F6', '#14B8A6', '#A78BFA'];

  // Pathogen watch from external_data
  const pathogenWatch = (alerts.find(a => a.data_type === 'pathogen_watch')
    || (weather.find(w => w.data_type === 'pathogen_watch'))
    || {}).value?.pathogens || [
    'Influenza A/B', 'RSV', 'COVID-19', 'West Nile Virus', 'Valley Fever', 'Dengue', 'Norovirus',
  ];

  return (
    <div className="tab-fade space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Reports" value={data.total_reports} hint="Last 30 days" color="#3B82F6" icon="📋" />
        <StatCard
          label="Active Alerts"
          value={data.active_alerts}
          hint={data.active_alerts > 0 ? 'Action recommended' : 'All clear'}
          color="#EF4444"
          glow={data.active_alerts > 0}
          icon="🚨"
        />
        <StatCard
          label="Statewide Risk"
          value={<RiskBadge level={data.statewide_risk_level} size="lg" />}
          hint={`Avg score ${data.statewide_avg_score ?? 0}/100`}
          color={RISK_COLORS[data.statewide_risk_level] || '#3B82F6'}
        />
        <StatCard label="Counties Monitored" value={data.counties_monitored} hint="Across Arizona" color="#14B8A6" icon="🗺️" />
      </div>

      {/* Symptom trends */}
      <div className="glass rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Symptom Trends — Last 7 Days</h2>
            <p className="text-xs text-white/50">Top reported symptoms across Arizona</p>
          </div>
          <div className="text-[11px] text-white/40 font-mono">live · participatory</div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={data.symptom_trends || []}>
              <defs>
                {trendKeys.map((k, i) => (
                  <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={symColors[i % symColors.length]} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={symColors[i % symColors.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2040" />
              <XAxis dataKey="date" stroke="#8B8FA8" fontSize={11} />
              <YAxis stroke="#8B8FA8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: '#0F1019',
                  border: '1px solid #1E2040',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {trendKeys.map((k, i) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={symColors[i % symColors.length]}
                  strokeWidth={2}
                  fill={`url(#g-${k})`}
                  animationDuration={800}
                  name={prettyLabel(k)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* County heatmap grid */}
      <div className="glass rounded-2xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-1">County Risk Heatmap</h2>
        <p className="text-xs text-white/50 mb-4">Click a county to view its community profile</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data.county_breakdown || []).map(c => (
            <button
              key={c.county}
              onClick={() => onSelectCounty?.(c.county)}
              className="text-left rounded-xl p-3 border border-border hover:border-white/30 transition-all bg-card/50"
              style={{ boxShadow: `inset 0 0 0 1px ${RISK_COLORS[c.risk_level]}33` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{c.county}</div>
                  <div className="text-[11px] text-white/50">{c.reports} reports</div>
                </div>
                <RiskBadge level={c.risk_level} size="sm" />
              </div>
              <div className="text-[11px] text-white/60">
                Top symptom: <span className="text-white">{prettyLabel(c.top_symptom) || '—'}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, c.avg_risk_score || 0)}%`,
                    background: RISK_COLORS[c.risk_level],
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent alerts */}
        <div className="glass rounded-2xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {(data.recent_alerts || []).slice(0, 6).map((a, i) => (
              <div
                key={i}
                className={classNames(
                  'rounded-xl p-3 border bg-card/40',
                  a.value?.severity === 'high' ? 'border-risk-high/40' :
                  a.value?.severity === 'moderate' ? 'border-risk-elevated/40' : 'border-border',
                )}
              >
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-white/50 font-mono">
                    {a.source} · {a.region}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                    style={{
                      background: `${RISK_COLORS[
                        a.value?.severity === 'high' ? 'high' :
                        a.value?.severity === 'moderate' ? 'elevated' : 'moderate'
                      ]}1f`,
                      color: RISK_COLORS[
                        a.value?.severity === 'high' ? 'high' :
                        a.value?.severity === 'moderate' ? 'elevated' : 'moderate'
                      ],
                    }}
                  >
                    {a.value?.severity || 'info'}
                  </span>
                </div>
                <p className="text-sm leading-snug text-white/90">{a.value?.advisory}</p>
              </div>
            ))}
            {(data.recent_alerts || []).length === 0 && (
              <p className="text-sm text-white/40">No active alerts.</p>
            )}
          </div>
        </div>

        {/* External data: weather + pathogen watch */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Arizona Weather</h3>
            <div className="grid grid-cols-1 gap-3">
              {weather.filter(w => w.data_type === 'weather').slice(0, 3).map((w, i) => (
                <div key={i} className="flex items-center justify-between bg-card/50 rounded-xl p-3 border border-border">
                  <div>
                    <div className="text-sm font-semibold">{w.region}</div>
                    <div className="text-[11px] text-white/50">{w.value?.notes}</div>
                  </div>
                  <div className="text-right">
                    <div className="stat-num text-xl">{w.value?.temperature_f}°F</div>
                    <div className="text-[11px] text-white/50">RH {w.value?.humidity_pct}%</div>
                    <div className="text-[10px] mt-0.5">
                      Mosquito:{' '}
                      <span style={{
                        color: w.value?.mosquito_activity === 'High' ? '#EF4444' :
                               w.value?.mosquito_activity === 'Medium' ? '#F59E0B' : '#14B8A6',
                      }}>
                        {w.value?.mosquito_activity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Active Pathogen Watch</h3>
            <div className="flex flex-wrap gap-2">
              {pathogenWatch.map(p => (
                <span key={p} className="px-2.5 py-1 rounded-full text-xs bg-risk-critical/10 border border-risk-critical/30 text-risk-critical">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REPORT TAB — wizard
   ============================================================ */
function ReportTab() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [demographics, setDemographics] = useState({
    age_group: '18-34', sex: 'Female', zip_code: '', county: 'Pima',
  });
  const [symptoms, setSymptoms] = useState(
    SYMPTOM_LIST.reduce((acc, s) => ({ ...acc, [s.key]: false }), {})
  );
  const [exposure, setExposure] = useState({
    recent_travel: 'none', travel_destination: '',
    animal_exposure: 'none', outdoor_activity_hours: 0,
    crowded_settings: false, healthcare_worker: false,
    household_sick: false, water_source: 'municipal',
  });

  const reset = () => {
    setStep(1); setResult(null); setError(null); setSubmitting(false);
    setDemographics({ age_group: '18-34', sex: 'Female', zip_code: '', county: 'Pima' });
    setSymptoms(SYMPTOM_LIST.reduce((acc, s) => ({ ...acc, [s.key]: false }), {}));
    setExposure({
      recent_travel: 'none', travel_destination: '',
      animal_exposure: 'none', outdoor_activity_hours: 0,
      crowded_settings: false, healthcare_worker: false,
      household_sick: false, water_source: 'municipal',
    });
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const payload = {
        demographics,
        symptoms,
        exposure: { ...exposure, travel_destination: exposure.travel_destination || null },
      };
      const res = await api.submitReport(payload);
      setResult(res);
      setStep(5);
    } catch (e) {
      setError(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <RiskResultCard result={result} onReset={reset} />;

  return (
    <div className="tab-fade max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3, 4].map(n => (
          <React.Fragment key={n}>
            <div className={classNames(
              'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
              step >= n
                ? 'bg-gradient-to-br from-risk-critical to-risk-elevated text-white shadow-lg shadow-red-500/30'
                : 'bg-card border border-border text-white/40',
            )}>
              {n}
            </div>
            {n < 4 && (
              <div className={classNames(
                'flex-1 h-0.5 mx-2 transition-all',
                step > n ? 'bg-risk-elevated' : 'bg-border',
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="glass rounded-2xl p-5 sm:p-6">
        {step === 1 && <StepDemographics value={demographics} onChange={setDemographics} />}
        {step === 2 && <StepSymptoms value={symptoms} onChange={setSymptoms} />}
        {step === 3 && <StepExposure value={exposure} onChange={setExposure} />}
        {step === 4 && (
          <StepReview demographics={demographics} symptoms={symptoms} exposure={exposure} />
        )}

        {error && (
          <div className="mt-4 px-3 py-2 rounded-lg border border-risk-critical/40 bg-risk-critical/10 text-sm text-risk-critical">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card/50 hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-risk-critical to-risk-elevated text-white shadow-lg shadow-red-500/20 hover:opacity-90"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-risk-critical to-risk-elevated text-white shadow-lg shadow-red-500/20 hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Analyzing…' : 'Generate My Risk Profile →'}
            </button>
          )}
        </div>

        {submitting && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full shimmer" />
            </div>
            <p className="text-[11px] text-white/40 mt-2 font-mono">
              Running One Health risk model · enriching with CDC + weather · GPT-4o synthesis
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/40 mt-4 text-center max-w-2xl mx-auto leading-relaxed">
        OutbreakLens is a prototype surveillance tool. It does not provide medical diagnoses.
        Consult a healthcare provider for medical concerns. Call 911 for emergencies.
      </p>
    </div>
  );
}

function StepDemographics({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Tell us about you</h2>
      <p className="text-sm text-white/50 mb-5">Demographics help calibrate community risk signals.</p>
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Age group</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['0-17', '18-34', '35-54', '55+'].map(g => (
              <button
                key={g}
                onClick={() => onChange({ ...value, age_group: g })}
                className={classNames(
                  'py-2 rounded-lg border text-sm font-medium transition-all',
                  value.age_group === g
                    ? 'border-risk-elevated bg-risk-elevated/15 text-risk-elevated'
                    : 'border-border bg-card/50 text-white/70 hover:border-white/30',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Sex</label>
            <select
              value={value.sex}
              onChange={(e) => onChange({ ...value, sex: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
            >
              <option>Female</option>
              <option>Male</option>
              <option>Non-binary</option>
              <option>Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">ZIP code</label>
            <input
              type="text"
              value={value.zip_code}
              onChange={(e) => onChange({ ...value, zip_code: e.target.value })}
              placeholder="e.g. 85719"
              maxLength={10}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">County</label>
          <select
            value={value.county}
            onChange={(e) => onChange({ ...value, county: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
          >
            {ARIZONA_COUNTIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function StepSymptoms({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Which symptoms are you experiencing?</h2>
      <p className="text-sm text-white/50 mb-5">Select all that apply.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SYMPTOM_LIST.map(s => {
          const on = !!value[s.key];
          return (
            <button
              key={s.key}
              onClick={() => onChange({ ...value, [s.key]: !on })}
              className={classNames(
                'p-3 rounded-xl border text-left transition-all',
                on
                  ? 'border-risk-critical bg-risk-critical/15 shadow-lg shadow-red-500/10'
                  : 'border-border bg-card/50 hover:border-white/30',
              )}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={classNames('text-sm font-medium', on ? 'text-white' : 'text-white/80')}>
                {s.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepExposure({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Exposure context</h2>
      <p className="text-sm text-white/50 mb-5">One Health signals — environment, animals, and contacts.</p>
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Recent travel</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: 'none', label: 'None' },
              { k: 'domestic', label: 'Domestic' },
              { k: 'international', label: 'International' },
            ].map(o => (
              <button
                key={o.k}
                onClick={() => onChange({ ...value, recent_travel: o.k, travel_destination: o.k === 'none' ? '' : value.travel_destination })}
                className={classNames(
                  'py-2 rounded-lg border text-sm font-medium',
                  value.recent_travel === o.k ? 'border-risk-elevated bg-risk-elevated/15 text-risk-elevated' : 'border-border bg-card/50 text-white/70 hover:border-white/30',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {value.recent_travel !== 'none' && (
            <input
              type="text"
              value={value.travel_destination}
              onChange={(e) => onChange({ ...value, travel_destination: e.target.value })}
              placeholder="Destination (e.g., Mexico — Sonora)"
              className="mt-2 w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
            />
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Animal exposure</label>
          <select
            value={value.animal_exposure}
            onChange={(e) => onChange({ ...value, animal_exposure: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
          >
            <option value="none">None</option>
            <option value="livestock">Livestock</option>
            <option value="wildlife">Wildlife</option>
            <option value="sick_pets">Sick Pets</option>
            <option value="rodents">Rodents</option>
            <option value="mosquito_bites">Mosquito Bites</option>
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Outdoor activity hours (this week)</label>
            <input
              type="number"
              min={0}
              max={168}
              value={value.outdoor_activity_hours}
              onChange={(e) => onChange({ ...value, outdoor_activity_hours: parseInt(e.target.value || '0', 10) })}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Water source</label>
            <select
              value={value.water_source}
              onChange={(e) => onChange({ ...value, water_source: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-risk-elevated"
            >
              <option value="municipal">Municipal</option>
              <option value="well">Well</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <Toggle label="Crowded settings" value={value.crowded_settings} onChange={(v) => onChange({ ...value, crowded_settings: v })} />
          <Toggle label="Healthcare worker" value={value.healthcare_worker} onChange={(v) => onChange({ ...value, healthcare_worker: v })} />
          <Toggle label="Household sick" value={value.household_sick} onChange={(v) => onChange({ ...value, household_sick: v })} />
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={classNames(
        'flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all',
        value ? 'border-risk-elevated bg-risk-elevated/15 text-white' : 'border-border bg-card/50 text-white/70',
      )}
    >
      <span>{label}</span>
      <span className={classNames(
        'w-9 h-5 rounded-full relative transition-all',
        value ? 'bg-risk-elevated' : 'bg-white/10',
      )}>
        <span className={classNames(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
          value ? 'left-4' : 'left-0.5',
        )} />
      </span>
    </button>
  );
}

function StepReview({ demographics, symptoms, exposure }) {
  const checked = SYMPTOM_LIST.filter(s => symptoms[s.key]);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Review your report</h2>
      <p className="text-sm text-white/50 mb-5">Anonymous & aggregated. Submitting will run an AI risk assessment.</p>
      <div className="space-y-3">
        <ReviewRow label="Demographics" value={`${demographics.age_group} · ${demographics.sex} · ${demographics.county}${demographics.zip_code ? ' · ' + demographics.zip_code : ''}`} />
        <ReviewRow
          label="Symptoms"
          value={checked.length > 0 ? checked.map(s => s.label).join(', ') : 'None reported'}
        />
        <ReviewRow
          label="Travel"
          value={exposure.recent_travel === 'none' ? 'None' : `${exposure.recent_travel}${exposure.travel_destination ? ' — ' + exposure.travel_destination : ''}`}
        />
        <ReviewRow label="Animal exposure" value={prettyLabel(exposure.animal_exposure)} />
        <ReviewRow label="Outdoor hours" value={`${exposure.outdoor_activity_hours} hrs`} />
        <ReviewRow label="Water source" value={prettyLabel(exposure.water_source)} />
        <ReviewRow
          label="Other"
          value={[
            exposure.crowded_settings && 'Crowded settings',
            exposure.healthcare_worker && 'Healthcare worker',
            exposure.household_sick && 'Household sick',
          ].filter(Boolean).join(' · ') || '—'}
        />
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50">
      <span className="text-xs uppercase tracking-widest text-white/50 mt-0.5">{label}</span>
      <span className="text-sm text-white text-right max-w-[60%]">{value}</span>
    </div>
  );
}

/* ============================================================
   RISK RESULT CARD
   ============================================================ */
function RiskResultCard({ result, onReset }) {
  const r = result.risk_assessment || {};
  const score = r.risk_score || 0;
  const level = r.risk_level || 'low';
  const color = RISK_COLORS[level] || RISK_COLORS.low;
  const animated = useCountUp(score, 1400);

  const radialData = [{ name: 'risk', value: score, fill: color }];

  return (
    <div className="tab-fade max-w-4xl mx-auto space-y-5">
      <div className="gradient-border p-5 sm:p-7">
        <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="relative w-44 h-44 mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: '#1E2040' }} dataKey="value" cornerRadius={20} animationDuration={1400} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="stat-num text-4xl" style={{ color }}>{Math.round(animated)}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">/100</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <RiskBadge level={level} size="lg" glow={level === 'critical' || level === 'high'} />
              <span className="text-xs text-white/40 font-mono">report {result.report_id?.slice(0, 8)}…</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Your AI risk profile</h2>
            {r.arizona_context && (
              <p className="text-sm text-white/70 leading-relaxed">{r.arizona_context}</p>
            )}
          </div>
        </div>
      </div>

      {(r.alert_flags || []).length > 0 && (
        <div className="rounded-xl border border-risk-critical/50 bg-risk-critical/10 p-4 pulse-ring">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="text-sm font-semibold text-risk-critical mb-1">Action recommended</div>
              {(r.alert_flags || []).map((f, i) => (
                <p key={i} className="text-sm text-white/90">{f}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Primary concerns</h3>
          {(r.primary_concerns || []).length === 0 && <p className="text-sm text-white/40">No primary concerns.</p>}
          <div className="space-y-2.5">
            {(r.primary_concerns || []).map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="font-semibold text-sm">{c.pathogen}</div>
                  <span
                    className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      background: `${RISK_COLORS[c.likelihood === 'high' ? 'high' : c.likelihood === 'moderate' ? 'elevated' : 'low']}1f`,
                      color: RISK_COLORS[c.likelihood === 'high' ? 'high' : c.likelihood === 'moderate' ? 'elevated' : 'low'],
                    }}
                  >
                    {c.likelihood} likelihood
                  </span>
                </div>
                <p className="text-[13px] text-white/70 leading-relaxed">{c.reasoning}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Contributing factors</h3>
          {(r.contributing_factors || []).length === 0 && <p className="text-sm text-white/40">No specific contributing factors identified.</p>}
          <div className="space-y-2">
            {(r.contributing_factors || []).map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className={f.impact === 'increases' ? 'text-risk-critical' : 'text-risk-low'}>
                    {f.impact === 'increases' ? '↑' : '↓'}
                  </span>
                  <span className="text-white/80">{f.factor}</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/40">{f.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Recommendations</h3>
        <ol className="space-y-2 list-decimal list-inside">
          {(r.recommendations || []).map((rec, i) => (
            <li key={i} className="text-sm text-white/85 leading-relaxed">{rec}</li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-center pt-2">
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-lg bg-card/60 border border-border text-sm font-medium hover:border-white/30"
        >
          Submit another report
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   COMMUNITY MAP TAB
   ============================================================ */
function CommunityTab({ initialCounty, setInitialCounty }) {
  const [communities, setCommunities] = useState([]);
  const [selected, setSelected] = useState(initialCounty || 'Pima');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profLoading, setProfLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const r = await api.communities();
        if (cancel) return;
        setCommunities(r.communities || []);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    if (!selected) return;
    (async () => {
      try {
        setProfLoading(true);
        const r = await api.community(selected);
        if (cancel) return;
        setProfile(r);
      } finally {
        if (!cancel) setProfLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [selected]);

  useEffect(() => { if (initialCounty) setSelected(initialCounty); }, [initialCounty]);

  const lookup = (cnty) => communities.find(c => c.county === cnty);

  if (loading) return <LoadingPulse label="Loading community map…" />;

  return (
    <div className="tab-fade space-y-6">
      <div className="glass rounded-2xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-1">Arizona Community Map</h2>
        <p className="text-xs text-white/50 mb-4">Risk-coded county grid · click to view details</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ARIZONA_COUNTIES.map(c => {
            const info = lookup(c);
            const lv = info?.risk_level || 'low';
            const reports = info?.total_reports || 0;
            const isSel = selected === c;
            return (
              <button
                key={c}
                onClick={() => { setSelected(c); setInitialCounty?.(c); }}
                className={classNames(
                  'relative rounded-xl p-4 border text-left transition-all',
                  isSel ? 'border-white/60 scale-[1.02]' : 'border-border hover:border-white/30',
                )}
                style={{
                  background: `linear-gradient(135deg, ${RISK_COLORS[lv]}22 0%, transparent 80%)`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{c}</span>
                  <RiskBadge level={lv} size="sm" />
                </div>
                <div className="stat-num text-2xl" style={{ color: RISK_COLORS[lv] }}>{reports}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">reports / 7d</div>
                {info?.alert_active && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-risk-critical animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {profLoading && <LoadingPulse label={`Loading ${selected} profile…`} />}

      {profile && !profLoading && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <h2 className="text-xl font-bold">{profile.county} County</h2>
                  <p className="text-xs text-white/50">{profile.total_reports} reports · last 30 days</p>
                </div>
                <RiskBadge level={profile.risk_level} size="lg" glow={profile.alert_active} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <MiniStat label="Avg risk" value={`${profile.avg_risk_score?.toFixed?.(1) ?? profile.avg_risk_score}`} />
                <MiniStat label="Reports" value={profile.total_reports} />
                <MiniStat label="Risk level" value={profile.risk_level} />
                <MiniStat label="Alert" value={profile.alert_active ? 'Active' : 'None'} color={profile.alert_active ? RISK_COLORS.critical : RISK_COLORS.low} />
              </div>
              {profile.ai_summary && (
                <div className="mt-4 rounded-xl bg-card/50 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">AI community summary</div>
                  <p className="text-sm leading-relaxed text-white/85">{profile.ai_summary}</p>
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Community Risk Radar</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <RadarChart data={profile.radar || []}>
                    <PolarGrid stroke="#1E2040" />
                    <PolarAngleAxis dataKey="axis" stroke="#8B8FA8" fontSize={11} />
                    <PolarRadiusAxis stroke="#1E2040" tick={{ fill: '#8B8FA8', fontSize: 10 }} />
                    <Radar
                      dataKey="value"
                      stroke={RISK_COLORS[profile.risk_level] || '#3B82F6'}
                      fill={RISK_COLORS[profile.risk_level] || '#3B82F6'}
                      fillOpacity={0.3}
                      animationDuration={800}
                    />
                    <Tooltip contentStyle={{ background: '#0F1019', border: '1px solid #1E2040', borderRadius: 12, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Top symptoms</h3>
              {(profile.dominant_symptoms || []).length === 0 ? (
                <p className="text-sm text-white/40">No symptom signal yet.</p>
              ) : (
                <ol className="space-y-2">
                  {profile.dominant_symptoms.slice(0, 6).map((s, i) => (
                    <li key={s} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                      <span>{i + 1}. {prettyLabel(s)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-3">Community recommendations</h3>
              <ul className="space-y-2 text-sm text-white/85">
                {profile.risk_level === 'critical' || profile.risk_level === 'high' ? (
                  <>
                    <li>• Coordinate with local public health for outbreak investigation.</li>
                    <li>• Issue community advisory and amplify testing access.</li>
                    <li>• Activate human-in-the-loop epidemiology review.</li>
                  </>
                ) : profile.risk_level === 'elevated' ? (
                  <>
                    <li>• Increase passive surveillance; monitor for escalation.</li>
                    <li>• Share targeted prevention messaging in affected ZIPs.</li>
                  </>
                ) : (
                  <>
                    <li>• Continue routine surveillance.</li>
                    <li>• Encourage residents to report new symptoms early.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="stat-num text-lg" style={{ color: color || '#E4E6F0' }}>{value}</div>
    </div>
  );
}

/* ============================================================
   ABOUT TAB
   ============================================================ */
function AboutTab() {
  return (
    <div className="tab-fade max-w-4xl mx-auto space-y-6">
      <div className="gradient-border p-6 sm:p-8">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">About OutbreakLens</h1>
        <p className="text-white/70 leading-relaxed">
          OutbreakLens is a participatory surveillance risk platform built for the Arizona public health ecosystem.
          Residents self-report symptoms; the system enriches each report with weather, travel, and CDC alert context,
          then uses GPT-4o to generate individual and community risk profiles for emerging infectious disease threats.
        </p>
      </div>

      <Section title="Mission alignment">
        <p>
          OutbreakLens directly supports the <span className="font-semibold">Ending Pandemics Academy</span> mission of
          shrinking the time between symptom onset and public health response. Participatory data closes the gap that
          traditional clinical surveillance leaves open — the days between a person feeling sick and a clinician seeing them.
        </p>
      </Section>

      <Section title="One Health approach">
        <p>
          Every report captures human, animal, and environmental signals: outdoor activity, animal contact, water source,
          household exposure, travel, and crowding. The risk model considers these together — a fever alone is a symptom;
          a fever with mosquito exposure during monsoon humidity is a vector-borne signal worth amplifying.
        </p>
      </Section>

      <Section title="Data sources">
        <ul className="space-y-1.5 list-disc list-inside text-white/85">
          <li>Resident self-reports (anonymous, ZIP+county granularity)</li>
          <li>CDC travel advisories and disease alerts (sample data shown)</li>
          <li>Arizona Department of Health Services regional alerts</li>
          <li>Local weather (temperature, humidity → vector activity inference)</li>
          <li>Active pathogen watchlist tuned to the Arizona threat landscape</li>
        </ul>
      </Section>

      <div className="gradient-border p-6">
        <h2 className="text-2xl font-bold mb-4">Model Card — GPT-4o Risk Engine</h2>
        <div className="space-y-4 text-sm">
          <ModelRow label="Model" value="OpenAI GPT-4o (with deterministic heuristic fallback)" />
          <ModelRow
            label="Purpose"
            value="Generate individual risk scores, pathogen-likelihood rankings, contributing factors, and personalized recommendations from self-reported symptoms enriched with external context."
          />
          <ModelRow
            label="Inputs"
            value="Symptom checklist (11 features), demographics (age, sex, ZIP, county), exposure context (travel, animal contact, outdoor hours, crowding, healthcare-worker status, household sickness, water source), and external context (CDC + weather + AZDHS alerts)."
          />
          <ModelRow
            label="Outputs"
            value="riskScore (0–100), riskLevel (low/moderate/elevated/high/critical), primaryConcerns (pathogen + likelihood + reasoning), contributingFactors, recommendations, alertFlags, arizonaContext."
          />
          <ModelRow
            label="Limitations"
            value="Not a diagnostic tool. Quality depends on self-report accuracy. LLMs can hallucinate pathogen likelihoods; that is why outputs are framed as ranked hypotheses, not diagnoses, and why high/critical reports are routed to human review."
          />
          <ModelRow
            label="Bias considerations"
            value="Self-report channels under-sample populations with limited internet access, language barriers, or distrust of health systems. The Arizona deployment plan includes Spanish-language UI, tribal nation outreach, and community health-worker-mediated reporting to mitigate these gaps."
          />
          <ModelRow
            label="Human-in-the-loop"
            value="Every alert flagged 'high' or 'critical' — and every county that crosses an elevated risk threshold — is queued for review by a human public-health epidemiologist before any community-facing alert is broadcast. The AI proposes; humans approve, edit, or reject. The platform logs every reviewer decision for auditability."
          />
          <ModelRow
            label="Performance evaluation"
            value="Sensitivity and specificity of risk flags would be evaluated against confirmed laboratory-positive cases reported through ADHS in matching ZIP/time windows. Calibration plots and time-to-detection metrics (vs traditional ILI surveillance) form the headline performance dashboard."
          />
          <ModelRow
            label="Arizona-specific deployment"
            value="The pathogen watchlist is tuned to Arizona's actual epidemiology — Valley Fever (year-round), West Nile (monsoon), Dengue (border counties), Hantavirus (rural rodent exposure), seasonal flu, and emergent COVID variants. Severity thresholds were calibrated to ADHS alerting conventions."
          />
        </div>
      </div>

      <Section title="Architecture">
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <pre className="text-[11px] sm:text-xs font-mono leading-relaxed text-white/80 overflow-x-auto">
{`Resident → React/Vite UI ──► FastAPI ──► MongoDB
                              │
                              ├──► GPT-4o (assess_risk)
                              │       └─ heuristic fallback if no API key
                              │
                              └──► External enrichment
                                    ├── CDC alerts
                                    ├── ADHS county alerts
                                    └── Weather → vector activity
                                          ↓
                                  Risk profile + community rollup
                                          ↓
                                  Human-in-the-loop review (epidemiologist)
                                          ↓
                                  Community advisory / dashboard surface`}
          </pre>
        </div>
      </Section>

      <Section title="Future roadmap">
        <ul className="space-y-1.5 list-disc list-inside text-white/85">
          <li>EpiCore API integration for real-time global disease intelligence</li>
          <li>SMS / push notifications for community alerts (opt-in, geo-targeted)</li>
          <li>Spanish-language UI for Arizona border communities</li>
          <li>Direct integration with Arizona Department of Health Services case-management systems</li>
          <li>Longitudinal tracking and trend prediction (LSTM-based outbreak nowcasting)</li>
        </ul>
      </Section>

      <div className="rounded-2xl border border-risk-critical/40 bg-risk-critical/5 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚕️</span>
          <div>
            <h3 className="font-semibold text-risk-critical mb-1">Medical disclaimer</h3>
            <p className="text-sm text-white/80 leading-relaxed">
              OutbreakLens is a prototype surveillance tool. It does not provide medical diagnoses.
              Consult a healthcare provider for medical concerns. Call 911 for emergencies.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-white/40 pt-4">
        Built for Hack Arizona 2026 · Track 2: Participatory Surveillance Risk Challenge
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="text-sm text-white/85 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function ModelRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-2 border-b border-border/50 last:border-0">
      <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-white/85 leading-relaxed">{value}</div>
    </div>
  );
}

/* ============================================================
   STATES
   ============================================================ */
function LoadingPulse({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full bg-risk-critical/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-risk-critical animate-pulse" />
      </div>
      <p className="mt-4 text-sm text-white/50">{label}</p>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-risk-critical/40 bg-risk-critical/5 p-6">
      <h3 className="font-semibold text-risk-critical mb-2">Backend unreachable</h3>
      <p className="text-sm text-white/70 mb-2">{message}</p>
      <p className="text-xs text-white/50 font-mono">
        Make sure the API is running at {API_BASE}. From the backend folder:
        <br />
        <span className="text-white/80">python seed.py && uvicorn main:app --reload --port 3001</span>
      </p>
    </div>
  );
}

function prettyLabel(k) {
  if (!k) return '';
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [selectedCounty, setSelectedCounty] = useState(null);

  const goCommunity = (cnty) => {
    setSelectedCounty(cnty);
    setTab('community');
  };

  return (
    <div className="min-h-screen relative">
      <ParticleBg />
      <Navbar tab={tab} setTab={setTab} />
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {tab === 'dashboard' && <Dashboard onSelectCounty={goCommunity} />}
        {tab === 'report' && <ReportTab />}
        {tab === 'community' && (
          <CommunityTab initialCounty={selectedCounty} setInitialCounty={setSelectedCounty} />
        )}
        {tab === 'about' && <AboutTab />}
      </main>
      <footer className="relative z-10 border-t border-border/50 mt-10 py-6 text-center text-[11px] text-white/40">
        OutbreakLens · participatory surveillance prototype · prototype for Hack Arizona 2026
      </footer>
    </div>
  );
}
