import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────

const REQ_KEYS = ["functional", "scale", "integration", "risk", "security", "commercial"];
const SOURCING_KEYS = ["nda", "masterAgreement", "commodity", "licenseModel", "competitiveBid", "riskAssessment", "securityReview", "legalReview"];

async function loadAllProjects() {
  const { data: projects } = await supabase.from("po_projects").select("*").order("created_at", { ascending: false });
  if (!projects || projects.length === 0) return null;

  const ids = projects.map(p => p.id);
  const [{ data: reqs }, { data: vendors }, { data: signoffs }, { data: timeline }, { data: sourcing }, { data: activity }] = await Promise.all([
    supabase.from("po_requirements").select("*").in("project_id", ids),
    supabase.from("po_vendors").select("*").in("project_id", ids).order("sort_order"),
    supabase.from("po_signoffs").select("*").in("project_id", ids).order("sort_order"),
    supabase.from("po_timeline").select("*").in("project_id", ids).order("sort_order"),
    supabase.from("po_sourcing").select("*").in("project_id", ids),
    supabase.from("po_activity").select("*").in("project_id", ids).order("created_at", { ascending: false }),
  ]);

  return projects.map(p => {
    const pReqs = (reqs || []).filter(r => r.project_id === p.id);
    const requirements = REQ_KEYS.reduce((a, k) => {
      const r = pReqs.find(x => x.key === k);
      return { ...a, [k]: { text: r?.text || "", status: r?.status || "tbd" } };
    }, {});

    const pSourcing = (sourcing || []).filter(s => s.project_id === p.id);
    const sourcingObj = SOURCING_KEYS.reduce((a, k) => {
      const s = pSourcing.find(x => x.key === k);
      return { ...a, [k]: s?.status || "required" };
    }, {});

    const pActivity = (activity || []).filter(a => a.project_id === p.id);

    return {
      nextAction: p.next_action || "",
      name: p.name,
      dept: p.dept,
      stage: p.stage,
      requestor: p.requestor,
      category: p.category,
      problemStage: p.problem_stage,
      useCase: p.use_case,
      budgetLow: Number(p.budget_low),
      budgetHigh: Number(p.budget_high),
      updatedDaysAgo: Math.floor((Date.now() - new Date(p.updated_at)) / 86400000),
      vendors: (vendors || []).filter(v => v.project_id === p.id).map(v => ({ id: v.id, name: v.name, fit: Number(v.fit), notes: v.notes })),
      signoffs: (signoffs || []).filter(s => s.project_id === p.id).map(s => ({ id: s.id, role: s.role, name: s.name, status: s.status })),
      timeline: (timeline || []).filter(t => t.project_id === p.id).map(t => ({ id: t.id, label: t.label, day: t.day, done: t.done })),
      requirements,
      sourcing: sourcingObj,
      activity: pActivity.map(a => ({
        id: a.id,
        initials: a.initials,
        text: a.text,
        type: a.type || "note",
        created_at: a.created_at,
        daysAgo: Math.floor((Date.now() - new Date(a.created_at)) / 86400000),
      })),
    };
  });
}

async function saveNewProject(proj) {
  await supabase.from("po_projects").insert([{
    id: proj.id, name: proj.name, dept: proj.dept || "", stage: proj.stage,
    requestor: proj.requestor, category: proj.category,
    problem_stage: proj.problemStage, use_case: proj.useCase,
    budget_low: proj.budgetLow, budget_high: proj.budgetHigh,
  }]);

  const reqRows = REQ_KEYS.map((k, i) => ({
    id: proj.id + "_req_" + k, project_id: proj.id, key: k,
    text: proj.requirements[k]?.text || "", status: proj.requirements[k]?.status || "tbd",
  }));
  await supabase.from("po_requirements").insert(reqRows);

  const sourcing = proj.sourcing || {};
  const srcRows = SOURCING_KEYS.map(k => ({
    id: proj.id + "_src_" + k, project_id: proj.id, key: k, status: sourcing[k] || "required",
  }));
  await supabase.from("po_sourcing").insert(srcRows);

  if (proj.signoffs?.length) {
    const sfRows = proj.signoffs.map((s, i) => ({
      id: proj.id + "_sf_" + i, project_id: proj.id,
      role: s.role, name: s.name, status: s.status, sort_order: i,
    }));
    await supabase.from("po_signoffs").insert(sfRows);
  }

  if (proj.timeline?.length) {
    const tlRows = proj.timeline.map((t, i) => ({
      id: proj.id + "_tl_" + i, project_id: proj.id,
      label: t.label, day: t.day, done: t.done, sort_order: i,
    }));
    await supabase.from("po_timeline").insert(tlRows);
  }

  await supabase.from("po_activity").insert([{
    id: proj.id + "_act_0", project_id: proj.id,
    initials: "—", text: "Project created",
  }]);
}

async function updateProjectField(id, fields) {
  const mapped = {};
  if (fields.name !== undefined)         mapped.name = fields.name;
  if (fields.stage !== undefined)        mapped.stage = fields.stage;
  if (fields.useCase !== undefined)      mapped.use_case = fields.useCase;
  if (fields.problemStage !== undefined) mapped.problem_stage = fields.problemStage;
  if (fields.budgetLow !== undefined)    mapped.budget_low = fields.budgetLow;
  if (fields.budgetHigh !== undefined)   mapped.budget_high = fields.budgetHigh;
  if (fields.category !== undefined)     mapped.category = fields.category;
  if (fields.requestor !== undefined)    mapped.requestor = fields.requestor;
  if (fields.nextAction !== undefined)   mapped.next_action = fields.nextAction;
  if (Object.keys(mapped).length) {
    await supabase.from("po_projects").update(mapped).eq("id", id);
  }
}

async function updateRequirement(projectId, key, text, status) {
  await supabase.from("po_requirements")
    .upsert({ id: projectId + "_req_" + key, project_id: projectId, key, text, status }, { onConflict: "project_id,key" });
}

async function updateSourcingItem(projectId, key, status) {
  await supabase.from("po_sourcing")
    .upsert({ id: projectId + "_src_" + key, project_id: projectId, key, status }, { onConflict: "project_id,key" });
}

async function saveVendors(projectId, vendors) {
  await supabase.from("po_vendors").delete().eq("project_id", projectId);
  if (vendors.length) {
    await supabase.from("po_vendors").insert(vendors.map((v, i) => ({
      id: v.id, project_id: projectId, name: v.name, fit: v.fit, notes: v.notes, sort_order: i,
    })));
  }
}

async function saveSignoffs(projectId, signoffs) {
  await supabase.from("po_signoffs").delete().eq("project_id", projectId);
  if (signoffs.length) {
    await supabase.from("po_signoffs").insert(signoffs.map((s, i) => ({
      id: s.id || projectId + "_sf_" + Date.now() + "_" + i,
      project_id: projectId, role: s.role, name: s.name, status: s.status, sort_order: i,
    })));
  }
}

async function saveTimeline(projectId, timeline) {
  await supabase.from("po_timeline").delete().eq("project_id", projectId);
  if (timeline.length) {
    await supabase.from("po_timeline").insert(timeline.map((t, i) => ({
      id: t.id, project_id: projectId, label: t.label, day: t.day, done: t.done, sort_order: i,
    })));
  }
}

// ── SEED DATA ─────────────────────────────────────────────────────────────────

const PROBLEM_STAGES = [
  "I know my problem and I need help finding a solution",
  "I know a solution (sw vendor) and I'm interested how it could be applied here",
  "I'm working with a supplier",
];

const SEED_PROJECTS = [
  {
    id: "p1", name: "Enterprise data warehouse migration", dept: "Data & Analytics — IT",
    stage: "approval", requestor: "J. Reyes", budgetLow: 820000, budgetHigh: 1100000,
    updatedDaysAgo: 2, category: "Software / SaaS",
    problemStage: PROBLEM_STAGES[2],
    useCase: "Migrate legacy on-prem data warehouse to cloud. Must support current BI stack and scale to 3x current data volume. Downtime tolerance is low — finance reporting runs nightly. Failure would block month-end close.",
    vendors: [
      { id: "v1", name: "Snowflake + Accenture", fit: 91, notes: "Best fit for scale and existing BI stack. Accenture handles migration complexity." },
      { id: "v2", name: "Google BigQuery + KPMG", fit: 82, notes: "Strong cloud-native option, KPMG has prior relationship." },
      { id: "v3", name: "Databricks", fit: 74, notes: "Good for data engineering use cases, less turnkey." },
      { id: "v4", name: "Azure Synapse", fit: 68, notes: "Viable if org is already Microsoft-heavy." },
    ],
    requirements: {
      functional: { text: "Platform must support real-time and batch ingestion, and integrate with existing Tableau and Power BI environments without re-engineering dashboards.", status: "confirmed" },
      scale: { text: "Must scale to 3x current data volume (approx. 900TB) within 18 months, with auto-scaling to handle peak finance reporting loads.", status: "confirmed" },
      integration: { text: "Must integrate with existing Salesforce, SAP, and internal data pipelines via REST API and Kafka connectors.", status: "confirmed" },
      risk: { text: "Downtime tolerance is near-zero — finance reporting runs nightly and failure would block month-end close. Requires hot-failover capability.", status: "confirmed" },
      security: { text: "All data must remain in US regions. SOC 2 Type II certification required. PII data must be encrypted at rest and in transit.", status: "confirmed" },
      commercial: { text: "Budget approved up to $1.1M for migration plus first-year platform costs. Prefer multi-year commitment with price caps.", status: "confirmed" },
    },
    signoffs: [
      { role: "Requestor", name: "J. Reyes, VP Data & Analytics", status: "approved" },
      { role: "Procurement lead", name: "M. Chen", status: "approved" },
      { role: "Finance", name: "K. Okafor, Dir. FP&A", status: "pending" },
      { role: "Senior leadership", name: "CTO sign-off required", status: "required" },
    ],
    activity: [
      { initials: "MC", text: "Submitted for Finance approval", daysAgo: 2 },
      { initials: "JR", text: "Approved vendor selection — Snowflake + Accenture", daysAgo: 4 },
      { initials: "MC", text: "Completed RFP scoring. 3 vendors evaluated.", daysAgo: 9 },
    ],
    timeline: [
      { id: "t1", label: "Requirements defined", day: 1, done: true },
      { id: "t2", label: "Vendors identified", day: 3, done: true },
      { id: "t3", label: "Go to market / NDA", day: 4, done: true },
      { id: "t4", label: "Vendor response", day: 8, done: true },
      { id: "t5", label: "Acquisition strategy", day: 13, done: false },
    ],
    sourcing: {
      nda: "complete", masterAgreement: "complete", commodity: "complete", licenseModel: "in-progress",
      competitiveBid: "complete", riskAssessment: "required", securityReview: "na", legalReview: "in-progress",
    },
  },
  {
    id: "p2", name: "Field sales CRM expansion", dept: "Sales Operations",
    stage: "execution", requestor: "T. Brooks", budgetLow: 240000, budgetHigh: 380000,
    updatedDaysAgo: 0, category: "Software / SaaS",
    problemStage: PROBLEM_STAGES[2],
    useCase: "Expand Salesforce licenses and add CPQ module to support 80 new field reps coming on in Q3. Must integrate with our existing quoting workflow and ERP.",
    vendors: [
      { id: "v1", name: "Salesforce (existing)", fit: 88, notes: "Incumbent with deep integration. Renewal leverage is timing." },
      { id: "v2", name: "HubSpot CRM", fit: 61, notes: "Viable alternative — primarily useful as negotiation pressure." },
    ],
    requirements: {
      functional: { text: "CPQ module must support complex product bundles and approval chains for deals over $500K.", status: "confirmed" },
      scale: { text: "Must support 80 additional named user licenses with room to grow to 150 by end of year.", status: "confirmed" },
      integration: { text: "Must integrate with NetSuite ERP for order management and contract sync.", status: "confirmed" },
      risk: { text: "Sales team goes live Q3 — any delay to license provisioning directly impacts revenue target.", status: "confirmed" },
      security: { text: "SSO via Okta required. Data residency in US.", status: "draft" },
      commercial: { text: "Target annual cost under $380K including CPQ. Prefer 2-year term with Q3 start.", status: "draft" },
    },
    signoffs: [
      { role: "Requestor", name: "T. Brooks, VP Sales Ops", status: "approved" },
      { role: "Procurement lead", name: "M. Chen", status: "approved" },
      { role: "Finance", name: "K. Okafor, Dir. FP&A", status: "pending" },
      { role: "Senior leadership", name: "Not required at this budget level", status: "na" },
    ],
    activity: [
      { initials: "TB", text: "Shared CPQ requirements doc with Salesforce AE", daysAgo: 0 },
      { initials: "MC", text: "Requested competitive quote from HubSpot for leverage", daysAgo: 3 },
    ],
    timeline: [
      { id: "t1", label: "Requirements defined", day: 1, done: true },
      { id: "t2", label: "Vendors identified", day: 3, done: true },
      { id: "t3", label: "Go to market / NDA", day: 4, done: true },
      { id: "t4", label: "Vendor response", day: 8, done: false },
      { id: "t5", label: "Acquisition strategy", day: 13, done: false },
    ],
    sourcing: {
      nda: "complete", masterAgreement: "in-progress", commodity: "complete", licenseModel: "complete",
      competitiveBid: "in-progress", riskAssessment: "required", securityReview: "na", legalReview: "required",
    },
  },
  {
    id: "p5", name: "HR learning management system", dept: "Human Resources",
    stage: "concept", requestor: "A. Williams", budgetLow: 0, budgetHigh: 0,
    updatedDaysAgo: 7, category: "Software / SaaS",
    problemStage: PROBLEM_STAGES[0],
    useCase: "HR wants to consolidate training content across three current tools into one LMS. Primary use case is compliance training and onboarding.",
    vendors: [],
    requirements: {
      functional: { text: "", status: "tbd" },
      scale: { text: "", status: "tbd" },
      integration: { text: "", status: "tbd" },
      risk: { text: "", status: "tbd" },
      security: { text: "", status: "tbd" },
      commercial: { text: "", status: "tbd" },
    },
    signoffs: [
      { role: "Requestor", name: "", status: "required" },
      { role: "Procurement lead", name: "M. Chen", status: "required" },
      { role: "Finance", name: "", status: "required" },
    ],
    activity: [
      { initials: "AW", text: "Initial use case submitted", daysAgo: 7 },
    ],
    timeline: [
      { id: "t1", label: "Requirements defined", day: 1, done: false },
      { id: "t2", label: "Vendors identified", day: 3, done: false },
      { id: "t3", label: "Go to market / NDA", day: 4, done: false },
      { id: "t4", label: "Vendor response", day: 8, done: false },
      { id: "t5", label: "Acquisition strategy", day: 13, done: false },
    ],
    sourcing: {
      nda: "required", masterAgreement: "required", commodity: "required", licenseModel: "required",
      competitiveBid: "required", riskAssessment: "required", securityReview: "na", legalReview: "required",
    },
  },
];

const STAGE_CONFIG = {
  concept:    { label: "Concept",    color: "#888780", pct: 12 },
  definition: { label: "Definition", color: "#378ADD", pct: 38 },
  execution:  { label: "Execution",  color: "#EF9F27", pct: 60 },
  approval:   { label: "Approval",   color: "#D4537E", pct: 80 },
  agreement:  { label: "Agreement",  color: "#1D9E75", pct: 100 },
};

const STAGES = ["concept", "definition", "execution", "approval", "agreement"];

const REQ_CATEGORIES = [
  { key: "functional",  label: "Functional",  color: "#378ADD", prompt: "What must this solution actually do? List primary capabilities." },
  { key: "scale",       label: "Scalability", color: "#1D9E75", prompt: "Dept-level or enterprise-wide? User count? Growth support?" },
  { key: "integration", label: "Integration", color: "#EF9F27", prompt: "What systems must this connect to? API or SSO requirements?" },
  { key: "risk",        label: "Risk",        color: "#E24B4A", prompt: "What happens if it stops working? Fallback? Compliance exposure?" },
  { key: "security",    label: "Security",    color: "#D4537E", prompt: "What data does this touch? Regulatory requirements? Data residency?" },
  { key: "commercial",  label: "Commercial",  color: "#9B6DD4", prompt: "Budget range? Contract structure preference? Term length constraints?" },
];

const SOURCING_CHECKLIST = [
  { key: "nda",             label: "NDA",                      desc: "Non-disclosure agreement in place with vendor(s)" },
  { key: "masterAgreement", label: "Master Agreement",         desc: "MSA or framework agreement established or under negotiation" },
  { key: "commodity",       label: "Commodity Classification", desc: "Spend category and commodity code assigned" },
  { key: "licenseModel",    label: "License Model",            desc: "License structure understood and documented" },
  { key: "competitiveBid",  label: "Competitive Bid",          desc: "At least one competitive alternative has been engaged" },
  { key: "riskAssessment",  label: "Risk Assessment",          desc: "Vendor and delivery risk formally assessed" },
  { key: "securityReview",  label: "Security Review",          desc: "Information security review completed or in progress" },
  { key: "legalReview",     label: "Legal Review",             desc: "Contract terms reviewed by legal counsel" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return "—";
  return "$" + (n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : (n / 1000).toFixed(0) + "K");
}

function updatedLabel(d) {
  if (d === 0) return "Updated today";
  if (d === 1) return "Updated yesterday";
  return `Updated ${d} days ago`;
}

function stageIndex(s) { return STAGES.indexOf(s); }

// Sourcing item values: "na" | "required" | "in-progress" | "complete"
// na = excluded from score, required = 0, in-progress = 50, complete = 100
function calcRiskScore(sourcing) {
  if (!sourcing) return 0;
  const items = SOURCING_CHECKLIST.map(i => sourcing[i.key] || "required").filter(v => v !== "na");
  if (items.length === 0) return 100;
  const total = items.reduce((sum, v) => {
    if (v === "complete") return sum + 100;
    if (v === "in-progress") return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / items.length);
}

function blankSourcing() {
  return SOURCING_CHECKLIST.reduce((a, i) => ({ ...a, [i.key]: "required" }), {});
}

function blankTimeline() {
  return [
    { id: "t1", label: "Requirements defined", day: 1, done: false },
    { id: "t2", label: "Vendors identified",   day: 3, done: false },
    { id: "t3", label: "Go to market / NDA",   day: 4, done: false },
    { id: "t4", label: "Vendor response",       day: 8, done: false },
    { id: "t5", label: "Acquisition strategy",  day: 13, done: false },
  ];
}

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────

const C = {
  bg: "#0B0B0E", surface: "#111116", border: "rgba(255,255,255,0.07)",
  text: "#E2DDD6", muted: "rgba(255,255,255,0.35)", gold: "#C8922A",
  blue: "#4A90D9", green: "#5DB88A", red: "#E24B4A",
};

const css = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Libre Baskerville', Georgia, serif" },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 36px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 200 },
  wordmark: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, letterSpacing: 1, color: "#fff" },
  nav: { background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 36px", position: "sticky", top: 60, zIndex: 199 },
  navBtn: (a) => ({ background: "none", border: "none", borderBottom: a ? `2px solid ${C.gold}` : "2px solid transparent", color: a ? C.gold : C.muted, padding: "0 18px", height: 44, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Libre Baskerville', Georgia, serif", transition: "all 0.15s" }),
  body: { padding: "32px 36px 60px" },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px" },
  secHead: { fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 0.3 },
  btn: (v = "ghost") => ({
    background: v === "primary" ? C.gold : v === "danger" ? "#8B3A3A" : "rgba(255,255,255,0.06)",
    color: v === "primary" ? "#000" : "#fff",
    border: `1px solid ${v === "primary" ? C.gold : v === "danger" ? "#8B3A3A" : C.border}`,
    borderRadius: 5, padding: "7px 14px", fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.3, transition: "all 0.15s",
  }),
  input: { background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { background: "#1a1a20", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.muted, padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}`, fontFamily: "monospace" },
  td: { padding: "11px 10px", borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 13, verticalAlign: "middle" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#16161c", border: `1px solid ${C.border}`, borderRadius: 10, padding: 28, width: 680, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" },
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function SDot({ color }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 6, flexShrink: 0, verticalAlign: "middle" }} />;
}

function StageBadge({ stage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44`, fontFamily: "monospace", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

function ProgressBar({ pct, color, height = 3 }) {
  return (
    <div style={{ height, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

function SignoffChip({ status }) {
  const map = {
    approved: { label: "Approved",    bg: "#E1F5EE", color: "#0F6E56" },
    pending:  { label: "Pending",     bg: "#F1EFE8", color: "#5F5E5A" },
    required: { label: "Not started", bg: "#FAEEDA", color: "#854F0B" },
    na:       { label: "N/A",         bg: "rgba(255,255,255,0.05)", color: C.muted },
  };
  const s = map[status] || map.required;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color, fontFamily: "monospace" }}>{s.label}</span>;
}

function StageProgress({ current }) {
  return (
    <div style={{ display: "flex", marginBottom: "1.5rem" }}>
      {STAGES.map((s, i) => {
        const cfg = STAGE_CONFIG[s];
        const isDone = stageIndex(current) > i;
        const isActive = current === s;
        return (
          <div key={s} style={{ flex: 1, padding: "8px 0", textAlign: "center", position: "relative" }}>
            {i < STAGES.length - 1 && (
              <div style={{ position: "absolute", top: 14, left: "50%", right: "-50%", height: 2, background: isDone ? C.green : C.border, zIndex: 0 }} />
            )}
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: isDone ? C.green : isActive ? "#fff" : C.border, margin: "0 auto 5px", position: "relative", zIndex: 1, boxShadow: isActive ? `0 0 0 3px rgba(255,255,255,0.1)` : "none" }} />
            <div style={{ fontSize: 10, color: isActive ? "#fff" : C.muted, fontWeight: isActive ? 700 : 400, fontFamily: "monospace" }}>{cfg.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── TIMELINE TAB ──────────────────────────────────────────────────────────────

function TimelineTab({ project, onUpdate }) {
  const timeline = project.timeline || blankTimeline();
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDay, setEditDay] = useState("");

  function toggleDone(id) {
    onUpdate(project.id, { timeline: timeline.map(t => t.id === id ? { ...t, done: !t.done } : t) });
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditDay(String(t.day));
  }

  function saveEdit(id) {
    onUpdate(project.id, {
      timeline: [...timeline.map(t => t.id === id ? { ...t, label: editLabel, day: parseInt(editDay) || t.day } : t)]
        .sort((a, b) => a.day - b.day)
    });
    setEditingId(null);
  }

  const sorted = [...timeline].sort((a, b) => a.day - b.day);
  const startDate = new Date();

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: "1.5rem", fontStyle: "italic" }}>
        Day 1 = project kickoff. Click any milestone to mark complete. Click Edit to adjust labels or dates.
      </div>

      {/* Visual arc */}
      <div style={{ ...css.card, marginBottom: "1.5rem", padding: "32px 24px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
          {/* Track line */}
          <div style={{ position: "absolute", top: 16, left: "5%", right: "5%", height: 2, background: C.border, borderRadius: 1, zIndex: 0 }} />
          {/* Progress fill */}
          <div style={{ position: "absolute", top: 16, left: "5%", height: 2, background: C.gold, borderRadius: 1, zIndex: 0, width: `${(sorted.filter(t => t.done).length / Math.max(sorted.length - 1, 1)) * 90}%`, transition: "width 0.5s ease" }} />

          {sorted.map((t, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + t.day - 1);
            const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div key={t.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
                <div onClick={() => toggleDone(t.id)}
                  style={{ width: 34, height: 34, borderRadius: "50%", background: t.done ? C.green : C.surface, border: `2px solid ${t.done ? C.green : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s", marginBottom: 12 }}>
                  {t.done
                    ? <span style={{ fontSize: 15, color: "#000", fontWeight: 900 }}>✓</span>
                    : <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", fontWeight: 700 }}>{t.day}</span>
                  }
                </div>
                {editingId === t.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", width: 110 }}>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      style={{ ...css.input, fontSize: 11, padding: "4px 6px", textAlign: "center" }} autoFocus />
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: C.muted }}>Day</span>
                      <input value={editDay} onChange={e => setEditDay(e.target.value)}
                        style={{ ...css.input, fontSize: 11, padding: "4px 6px", width: 44, textAlign: "center" }} />
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ ...css.btn("primary"), fontSize: 10, padding: "3px 8px" }} onClick={() => saveEdit(t.id)}>Save</button>
                      <button style={{ ...css.btn(), fontSize: 10, padding: "3px 8px" }} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: t.done ? C.green : "#fff", fontWeight: 700, marginBottom: 3, lineHeight: 1.4 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 5 }}>{dateStr}</div>
                    <span onClick={() => startEdit(t)} style={{ fontSize: 10, color: C.muted, cursor: "pointer", fontFamily: "monospace" }}
                      onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = C.muted}>
                      edit
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: `1px solid ${t.done ? C.green + "44" : C.border}`, borderRadius: 8, background: t.done ? C.green + "08" : C.surface, transition: "all 0.2s" }}>
            <div onClick={() => toggleDone(t.id)}
              style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${t.done ? C.green : C.border}`, background: t.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {t.done && <span style={{ fontSize: 10, color: "#000", fontWeight: 900 }}>✓</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.done ? C.green : "#fff" }}>{t.label}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>Day {t.day}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SOURCING TAB ──────────────────────────────────────────────────────────────

function SourcingTab({ project, onUpdate }) {
  const sourcing = project.sourcing || blankSourcing();
  const score = calcRiskScore(sourcing);
  const scoreColor = score >= 75 ? C.green : score >= 50 ? C.gold : C.red;

  const applicable = SOURCING_CHECKLIST.filter(i => (sourcing[i.key] || "required") !== "na");
  const complete   = applicable.filter(i => sourcing[i.key] === "complete").length;
  const inProgress = applicable.filter(i => sourcing[i.key] === "in-progress").length;

  const STATUS_CONFIG = {
    "na":          { label: "N/A",         color: C.muted,   bg: "rgba(255,255,255,0.05)" },
    "required":    { label: "Required",    color: C.red,     bg: C.red + "15" },
    "in-progress": { label: "In Progress", color: C.gold,    bg: C.gold + "20" },
    "complete":    { label: "Complete",    color: C.green,   bg: C.green + "20" },
  };

  const STATUS_CYCLE = ["na", "required", "in-progress", "complete"];

  function setStatus(key, val) {
    onUpdate(project.id, { sourcing: { ...sourcing, [key]: val } });
  }

  return (
    <div>
      {/* Score strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${scoreColor}44`, borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>READINESS SCORE</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "monospace", marginBottom: 8 }}>
            {complete} complete · {inProgress} in progress · {applicable.length - complete - inProgress} required
          </div>
          <ProgressBar pct={score} color={scoreColor} height={4} />
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>RISK LEVEL</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor, marginBottom: 6 }}>
            {score >= 75 ? "Low Risk" : score >= 50 ? "Medium Risk" : "High Risk"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            {score >= 75 ? "Sourcing process is well covered." : score >= 50 ? "Several key items still outstanding." : "Critical sourcing gaps identified."}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>WHERE IN PROCESS</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{project.problemStage || "—"}</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: v.color, fontFamily: "monospace" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} />
            {v.label}{k !== "na" ? ` = ${k === "required" ? "0" : k === "in-progress" ? "50" : "100"}` : " (excluded)"}
          </div>
        ))}
      </div>

      {/* Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SOURCING_CHECKLIST.map(item => {
          const val = sourcing[item.key] || "required";
          const cfg = STATUS_CONFIG[val];
          return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: `1px solid ${cfg.color}33`, borderRadius: 8, background: cfg.bg, transition: "all 0.2s" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: val === "na" ? C.muted : "#fff", marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
              {/* 4-state selector */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {STATUS_CYCLE.map(s => {
                  const sc = STATUS_CONFIG[s];
                  const isActive = val === s;
                  return (
                    <button key={s} onClick={() => setStatus(item.key, s)}
                      style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "monospace", border: `1px solid ${isActive ? sc.color : C.border}`, background: isActive ? sc.bg : "transparent", color: isActive ? sc.color : C.muted, transition: "all 0.15s" }}>
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VENDOR TAB ────────────────────────────────────────────────────────────────

function VendorTab({ project, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newFit, setNewFit] = useState("75");

  function addVendor() {
    if (!newName.trim()) return;
    const vendor = { id: "v" + Date.now(), name: newName.trim(), fit: parseInt(newFit) || 75, notes: newNotes.trim() };
    onUpdate(project.id, { vendors: [...(project.vendors || []), vendor] });
    setNewName(""); setNewNotes(""); setNewFit("75"); setAdding(false);
  }

  function removeVendor(id) {
    onUpdate(project.id, { vendors: project.vendors.filter(v => v.id !== id) });
  }

  const vendors = project.vendors || [];

  return (
    <div>
      {vendors.length === 0 && !adding && (
        <div style={{ ...css.card, textAlign: "center", padding: "48px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>No vendors identified yet.</div>
          <button style={css.btn("primary")} onClick={() => setAdding(true)}>+ Add first vendor</button>
        </div>
      )}

      {vendors.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 16 }}>
          {vendors.map(v => (
            <div key={v.id} style={{ ...css.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{v.name}</div>
                <button onClick={() => removeVendor(v.id)}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 0 0 8px", lineHeight: 1 }}
                  onMouseEnter={e => e.target.style.color = C.red} onMouseLeave={e => e.target.style.color = C.muted}>✕</button>
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 8 }}>Fit score: {v.fit}%</div>
              <ProgressBar pct={v.fit} color={v.fit >= 80 ? C.green : v.fit >= 65 ? C.gold : C.muted} height={3} />
              {v.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>{v.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ ...css.card, borderColor: "rgba(200,146,42,0.3)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 14 }}>NEW VENDOR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vendor name" style={css.input} autoFocus />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)" style={{ ...css.input, flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>Fit %</span>
                <input value={newFit} onChange={e => setNewFit(e.target.value)} placeholder="75"
                  style={{ ...css.input, width: 60, textAlign: "center" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={css.btn("primary")} onClick={addVendor}>Add vendor</button>
              <button style={css.btn()} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        vendors.length > 0 && <button style={css.btn()} onClick={() => setAdding(true)}>+ Add vendor</button>
      )}
    </div>
  );
}

// ── APPROVALS TAB ────────────────────────────────────────────────────────────

function ApprovalsTab({ project, onUpdate }) {
  const signoffs = project.signoffs || [];
  const [editingIdx, setEditingIdx] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ role: "", name: "", status: "required" });

  const SIGNOFF_STATUSES = ["required", "pending", "approved", "na"];
  const STATUS_LABELS = { required: "Not started", pending: "Pending", approved: "Approved", na: "N/A" };

  function save(idx) {
    const updated = signoffs.map((s, i) => i === idx ? { ...editDraft } : s);
    onUpdate(project.id, { signoffs: updated });
    setEditingIdx(null);
  }

  function remove(idx) {
    onUpdate(project.id, { signoffs: signoffs.filter((_, i) => i !== idx) });
  }

  function addApprover() {
    if (!newDraft.role.trim()) return;
    onUpdate(project.id, { signoffs: [...signoffs, { ...newDraft }] });
    setNewDraft({ role: "", name: "", status: "required" });
    setAdding(false);
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const updated = [...signoffs];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    onUpdate(project.id, { signoffs: updated });
  }

  function moveDown(idx) {
    if (idx === signoffs.length - 1) return;
    const updated = [...signoffs];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    onUpdate(project.id, { signoffs: updated });
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {signoffs.map((s, i) => (
          <div key={i}>
            {editingIdx === i ? (
              <div style={{ padding: "14px 18px", border: `1px solid ${C.gold}44`, borderRadius: 8, background: C.gold + "08" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>ROLE</div>
                    <input value={editDraft.role} onChange={e => setEditDraft(d => ({ ...d, role: e.target.value }))}
                      style={css.input} placeholder="e.g. Finance" autoFocus />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>NAME / EMAIL</div>
                    <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                      style={css.input} placeholder="Name or email" />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 6 }}>STATUS</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {SIGNOFF_STATUSES.map(st => (
                      <button key={st} onClick={() => setEditDraft(d => ({ ...d, status: st }))}
                        style={{ fontSize: 11, fontWeight: editDraft.status === st ? 700 : 400, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "monospace", border: `1px solid ${editDraft.status === st ? C.gold : C.border}`, background: editDraft.status === st ? C.gold + "22" : "transparent", color: editDraft.status === st ? C.gold : C.muted }}>
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={css.btn("primary")} onClick={() => save(i)}>Save</button>
                  <button style={css.btn()} onClick={() => setEditingIdx(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface }}>
                {/* Reorder arrows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0}
                    style={{ background: "none", border: "none", color: i === 0 ? "rgba(255,255,255,0.1)" : C.muted, cursor: i === 0 ? "default" : "pointer", fontSize: 10, lineHeight: 1, padding: "1px 4px" }}>▲</button>
                  <button onClick={() => moveDown(i)} disabled={i === signoffs.length - 1}
                    style={{ background: "none", border: "none", color: i === signoffs.length - 1 ? "rgba(255,255,255,0.1)" : C.muted, cursor: i === signoffs.length - 1 ? "default" : "pointer", fontSize: 10, lineHeight: 1, padding: "1px 4px" }}>▼</button>
                </div>
                {/* Order number */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.muted, fontFamily: "monospace", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.role}</div>
                  {s.name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.name}</div>}
                </div>
                <SignoffChip status={s.status} />
                <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                  <button style={{ ...css.btn(), fontSize: 11, padding: "4px 10px" }}
                    onClick={() => { setEditDraft({ ...s }); setEditingIdx(i); }}>Edit</button>
                  <button style={{ ...css.btn("danger"), fontSize: 11, padding: "4px 10px" }}
                    onClick={() => remove(i)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add approver */}
      {adding ? (
        <div style={{ padding: "14px 18px", border: `1px solid ${C.gold}44`, borderRadius: 8, background: C.gold + "08" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>NEW APPROVER</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>ROLE</div>
              <input value={newDraft.role} onChange={e => setNewDraft(d => ({ ...d, role: e.target.value }))}
                style={css.input} placeholder="e.g. VP Engineering" autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>NAME / EMAIL</div>
              <input value={newDraft.name} onChange={e => setNewDraft(d => ({ ...d, name: e.target.value }))}
                style={css.input} placeholder="Name or email" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={css.btn("primary")} onClick={addApprover}>Add</button>
            <button style={css.btn()} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={css.btn()} onClick={() => setAdding(true)}>+ Add approver</button>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
        Use ▲▼ to reorder. LDAP/directory integration planned for future release.
      </div>
    </div>
  );
}

// ── SUMMARY TAB ───────────────────────────────────────────────────────────────

function SummaryTab({ project, riskScore, riskColor }) {
  const cfg = STAGE_CONFIG[project.stage];
  const si = stageIndex(project.stage);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const confirmedReqs = REQ_CATEGORIES.filter(r => project.requirements[r.key]?.status === "confirmed");
  const draftReqs = REQ_CATEGORIES.filter(r => project.requirements[r.key]?.status === "draft");
  const vendors = project.vendors || [];
  const timeline = [...(project.timeline || [])].sort((a, b) => a.day - b.day);
  const doneMilestones = timeline.filter(t => t.done);
  const nextMilestone = timeline.find(t => !t.done);
  const approvedSignoffs = (project.signoffs || []).filter(s => s.status === "approved");
  const pendingSignoffs = (project.signoffs || []).filter(s => s.status === "pending" || s.status === "required");

  const S = {
    page: { background: "#0F0F12", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 860, margin: "0 auto" },
    header: { background: "#16161C", borderBottom: `1px solid ${C.border}`, padding: "28px 36px" },
    body: { padding: "28px 36px" },
    section: { marginBottom: 28 },
    sectionLabel: { fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
    sectionLine: { flex: 1, height: 1, background: C.border },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
    metaCard: { background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 14px" },
    metaLabel: { fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 },
    metaValue: { fontSize: 14, fontWeight: 700, color: "#fff" },
    reqItem: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` },
    vendorRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` },
    tlItem: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0" },
  };

  function printSummary() {
    window.print();
  }

  return (
    <div>
      {/* Print / export action */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
        <button style={css.btn()} onClick={printSummary}>Print / Save as PDF</button>
      </div>

      <div style={S.page} id="summary-page">
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: C.gold, fontFamily: "monospace", marginBottom: 8 }}>Procurement OS · Project Summary</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 6 }}>{project.name}</div>
              {project.dept && <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{project.dept}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <StageBadge stage={project.stage} />
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginTop: 8 }}>{today}</div>
            </div>
          </div>

          {/* Stage progress bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 0 }}>
              {STAGES.map((s, i) => {
                const sc = STAGE_CONFIG[s];
                const isDone = si > i;
                const isActive = project.stage === s;
                return (
                  <div key={s} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ height: 3, background: isDone ? C.green : isActive ? sc.color : "rgba(255,255,255,0.08)", marginBottom: 6, borderRadius: 1 }} />
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: isActive ? "#fff" : C.muted, fontWeight: isActive ? 700 : 400 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={S.body}>

          {/* 1. Use case + engagement context */}
          {project.useCase && (
            <div style={S.section}>
              <div style={S.sectionLabel}>Use case<div style={S.sectionLine} /></div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, fontStyle: "italic", borderLeft: `3px solid ${C.gold}`, paddingLeft: 16, marginBottom: project.problemStage ? 10 : 0 }}>
                "{project.useCase}"
              </div>
              {project.problemStage && (
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 8 }}>
                  Engagement context: {project.problemStage}
                </div>
              )}
            </div>
          )}

          {/* 2. Requirements */}
          <div style={S.section}>
            <div style={S.sectionLabel}>Requirements<div style={S.sectionLine} /></div>
            {confirmedReqs.length === 0 && draftReqs.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No requirements defined yet.</div>
            ) : (
              <div>
                {[...confirmedReqs, ...draftReqs].map(r => {
                  const req = project.requirements[r.key];
                  if (!req?.text) return null;
                  return (
                    <div key={r.key} style={S.reqItem}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: r.color + "22", color: r.color, border: `1px solid ${r.color}44`, fontFamily: "monospace", whiteSpace: "nowrap", marginTop: 1 }}>{r.label}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{req.text}</div>
                      </div>
                      <span style={{ fontSize: 9, color: req.status === "confirmed" ? C.green : C.gold, fontFamily: "monospace", whiteSpace: "nowrap", marginTop: 2 }}>{req.status === "confirmed" ? "✓ Confirmed" : "Draft"}</span>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            )}
          </div>

          {/* 3. Sourcing readiness */}
          <div style={S.section}>
            <div style={S.sectionLabel}>
              Sourcing readiness
              <span style={{ fontSize: 13, fontWeight: 700, color: riskColor, fontFamily: "monospace" }}>{riskScore}%</span>
              <div style={S.sectionLine} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${riskScore}%`, background: riskColor, borderRadius: 2, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 11, color: riskColor, fontFamily: "monospace", marginTop: 5 }}>
                {riskScore >= 75 ? "Low risk — sourcing process well covered" : riskScore >= 50 ? "Medium risk — key items outstanding" : "High risk — critical sourcing gaps"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SOURCING_CHECKLIST.map(item => {
                const val = project.sourcing?.[item.key] || "required";
                const color = val === "complete" ? C.green : val === "in-progress" ? C.gold : val === "na" ? C.muted : C.red;
                const icon = val === "complete" ? "✓" : val === "in-progress" ? "~" : val === "na" ? "—" : "○";
                return (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 20, background: color + "15", border: `1px solid ${color}33`, color }}>
                    <span style={{ fontSize: 10 }}>{icon}</span>
                    <span style={{ fontFamily: "monospace" }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Timeline */}
          {timeline.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionLabel}>Timeline<div style={S.sectionLine} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {timeline.map(t => (
                  <div key={t.id} style={S.tlItem}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${t.done ? C.green : C.border}`, background: t.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {t.done && <span style={{ fontSize: 9, color: "#000", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 12, color: t.done ? C.green : "#fff", flex: 1 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Day {t.day}</div>
                  </div>
                ))}
              </div>
              {nextMilestone && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: C.gold + "15", border: `1px solid ${C.gold}33`, borderRadius: 6, fontSize: 11, color: C.gold, fontFamily: "monospace" }}>
                  Next: {nextMilestone.label} — Day {nextMilestone.day}
                </div>
              )}
            </div>
          )}

          {/* 5. Budget & commercial */}
          <div style={S.section}>
            <div style={S.sectionLabel}>Commercial parameters<div style={S.sectionLine} /></div>
            <div style={S.row3}>
              <div style={S.metaCard}>
                <div style={S.metaLabel}>BUDGET RANGE</div>
                <div style={S.metaValue}>{project.budgetLow > 0 ? `${fmt(project.budgetLow)} – ${fmt(project.budgetHigh)}` : "TBD"}</div>
              </div>
              <div style={S.metaCard}>
                <div style={S.metaLabel}>CATEGORY</div>
                <div style={{ ...S.metaValue, fontSize: 12 }}>{project.category || "—"}</div>
              </div>
              <div style={S.metaCard}>
                <div style={S.metaLabel}>REQUESTOR</div>
                <div style={{ ...S.metaValue, fontSize: 12 }}>{project.requestor || "—"}</div>
              </div>
            </div>
            {(() => {
              const commReq = project.requirements?.commercial;
              return commReq?.text ? (
                <div style={{ marginTop: 10, fontSize: 12, color: C.muted, lineHeight: 1.6, borderLeft: `2px solid #9B6DD4`, paddingLeft: 12 }}>
                  {commReq.text}
                </div>
              ) : null;
            })()}
          </div>

          {/* 6. Vendor shortlist */}
          {vendors.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionLabel}>Vendor shortlist<div style={S.sectionLine} /></div>
              {[...vendors].sort((a, b) => b.fit - a.fit).map(v => (
                <div key={v.id} style={S.vendorRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{v.name}</div>
                    {v.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{v.notes}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: v.fit >= 80 ? C.green : v.fit >= 65 ? C.gold : C.muted, fontFamily: "monospace" }}>{v.fit}% fit</div>
                    <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${v.fit}%`, background: v.fit >= 80 ? C.green : v.fit >= 65 ? C.gold : C.muted, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Project status & approvals */}
          <div style={S.section}>
            <div style={S.sectionLabel}>Status &amp; approvals<div style={S.sectionLine} /></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <StageBadge stage={project.stage} />
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                {approvedSignoffs.length} of {(project.signoffs || []).filter(s => s.status !== "na").length} approvals complete
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(project.signoffs || []).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{s.role}</span>
                    {s.name && <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>{s.name}</span>}
                  </div>
                  <SignoffChip status={s.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Generated by Procurement OS · {today}</div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Acuity Sourcing</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REQUIREMENTS TAB ─────────────────────────────────────────────────────────

function RequirementsTab({ project, onUpdate }) {
  const [expandedReq, setExpandedReq] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiPreview, setAiPreview] = useState(null); // generated but not yet accepted

  async function generateRequirements() {
    if (!project.useCase?.trim()) {
      setAiError("Add a use case in the Overview tab first — the AI needs it to generate requirements.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiPreview(null);

    const prompt = `You are an expert IT procurement analyst. A sourcing manager has captured this use case from a business unit:

"${project.useCase}"

${project.problemStage ? `Engagement context: ${project.problemStage}` : ""}
${project.category ? `Category: ${project.category}` : ""}

Generate concise, procurement-useful requirements across these six categories. Each should be 1-2 sentences — specific enough to use in a vendor RFP or evaluation, not generic.

Return ONLY a JSON object with no markdown or backticks:
{
  "functional": "...",
  "scale": "...",
  "integration": "...",
  "risk": "...",
  "security": "...",
  "commercial": "..."
}

Guidelines per category:
- functional: what the solution must actually do, specific capabilities
- scale: user count, data volume, geographic scope, growth expectations
- integration: existing systems this must connect to, APIs, SSO, data formats
- risk: what breaks if this fails, downtime tolerance, fallback, compliance exposure
- security: data classification, regulatory requirements (SOC2, HIPAA, GDPR), data residency
- commercial: budget range if known, contract structure preference, term length, pricing model`;

    try {
      const CLAUDE_URL = (process.env.REACT_APP_SUPABASE_URL || "") + "/functions/v1/claude-proxy";
      const res = await fetch(CLAUDE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.content) throw new Error("No content in response — check ANTHROPIC_API_KEY in Vercel environment variables.");
      const raw = (data.content || []).map(b => b.text || "").join("").trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response.");
      const parsed = JSON.parse(match[0]);
      setAiPreview(parsed);
    } catch (e) {
      setAiError("AI generation failed — " + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAll() {
    if (!aiPreview) return;
    const updated = { ...project.requirements };
    REQ_CATEGORIES.forEach(r => {
      if (aiPreview[r.key]) {
        updated[r.key] = { text: aiPreview[r.key], status: "draft" };
      }
    });
    onUpdate(project.id, { requirements: updated });
    setAiPreview(null);
    setExpandedReq(null);
  }

  function acceptOne(key) {
    if (!aiPreview?.[key]) return;
    onUpdate(project.id, {
      requirements: {
        ...project.requirements,
        [key]: { text: aiPreview[key], status: "draft" },
      },
    });
    setAiPreview(prev => { const n = { ...prev }; delete n[key]; return Object.keys(n).length ? n : null; });
  }

  return (
    <div>
      {/* Use case callout */}
      <div style={{ ...css.card, marginBottom: "1.5rem", borderLeft: `3px solid ${C.gold}` }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.gold, fontFamily: "monospace", marginBottom: 8 }}>Use case</div>
        <div style={{ fontSize: 13, color: project.useCase ? C.text : C.muted, lineHeight: 1.7, fontStyle: project.useCase ? "normal" : "italic" }}>
          {project.useCase || "No use case entered yet — add one in the Overview tab."}
        </div>
      </div>

      {/* AI generation bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(200,146,42,0.06)", border: `1px solid rgba(200,146,42,0.2)`, borderRadius: 8, marginBottom: "1.5rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>AI requirements draft</div>
          <div style={{ fontSize: 11, color: C.muted }}>Generate a first draft across all six categories from the use case. Review and edit before confirming.</div>
        </div>
        <button style={{ ...css.btn("primary"), flexShrink: 0, opacity: aiLoading ? 0.6 : 1 }}
          onClick={generateRequirements} disabled={aiLoading}>
          {aiLoading ? "Generating…" : aiPreview ? "Regenerate ↗" : "Generate with AI ↗"}
        </button>
      </div>

      {/* Error */}
      {aiError && (
        <div style={{ padding: "10px 14px", background: "rgba(226,75,74,0.1)", border: `1px solid rgba(226,75,74,0.3)`, borderRadius: 8, fontSize: 12, color: C.red, marginBottom: "1rem" }}>
          {aiError}
        </div>
      )}

      {/* AI preview banner */}
      {aiPreview && (
        <div style={{ padding: "12px 16px", background: "rgba(93,184,138,0.06)", border: `1px solid rgba(93,184,138,0.25)`, borderRadius: 8, marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.green }}>
            AI draft ready — review each requirement below, then accept individually or accept all.
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={{ ...css.btn(), fontSize: 11, color: C.muted }} onClick={() => setAiPreview(null)}>Discard</button>
            <button style={{ ...css.btn(), fontSize: 11, color: C.green, borderColor: "rgba(93,184,138,0.4)" }} onClick={acceptAll}>Accept all</button>
          </div>
        </div>
      )}

      {/* Requirement cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REQ_CATEGORIES.map(r => {
          const req = project.requirements[r.key];
          const isOpen = expandedReq === r.key;
          const preview = aiPreview?.[r.key];
          return (
            <div key={r.key} style={{ ...css.card, padding: 0, overflow: "hidden", border: preview ? `1px solid rgba(93,184,138,0.3)` : `1px solid ${C.border}` }}>
              <div onClick={() => setExpandedReq(isOpen ? null : r.key)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: r.color + "22", color: r.color, border: `1px solid ${r.color}44`, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.key.charAt(0).toUpperCase() + r.key.slice(1)} requirements</span>
                {preview && <span style={{ fontSize: 10, color: C.green, fontFamily: "monospace", fontWeight: 700 }}>AI draft ready</span>}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: req.status === "confirmed" ? C.green + "22" : req.status === "draft" ? C.blue + "22" : "rgba(255,255,255,0.05)", color: req.status === "confirmed" ? C.green : req.status === "draft" ? C.blue : C.muted, fontFamily: "monospace" }}>
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ padding: "0 16px 16px" }}>
                  {/* AI preview for this category */}
                  {preview && (
                    <div style={{ padding: "10px 14px", background: "rgba(93,184,138,0.06)", border: `1px solid rgba(93,184,138,0.2)`, borderRadius: 6, marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: C.green, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>AI DRAFT</div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>{preview}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...css.btn(), fontSize: 11, color: C.green, borderColor: "rgba(93,184,138,0.4)" }}
                          onClick={() => acceptOne(r.key)}>Accept this draft</button>
                        <button style={{ ...css.btn(), fontSize: 11, color: C.muted }}
                          onClick={() => setAiPreview(prev => { const n = { ...prev }; delete n[r.key]; return Object.keys(n).length ? n : null; })}>Dismiss</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontStyle: "italic", lineHeight: 1.5 }}>{r.prompt}</div>
                  <textarea value={req.text}
                    onChange={e => onUpdate(project.id, { requirements: { ...project.requirements, [r.key]: { ...req, text: e.target.value } } })}
                    placeholder={`Describe ${r.key} requirements…`} rows={3}
                    style={{ ...css.input, fontSize: 13, resize: "vertical", lineHeight: 1.6, marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>Status:</span>
                    {["tbd", "draft", "confirmed"].map(st => (
                      <span key={st} onClick={() => onUpdate(project.id, { requirements: { ...project.requirements, [r.key]: { ...req, status: st } } })}
                        style={{ fontSize: 11, fontWeight: req.status === st ? 700 : 400, padding: "3px 10px", borderRadius: 20, cursor: "pointer", border: `1px solid ${req.status === st ? r.color : C.border}`, color: req.status === st ? r.color : C.muted, background: req.status === st ? r.color + "22" : "transparent", fontFamily: "monospace" }}>
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOG TAB ───────────────────────────────────────────────────────────────────

const LOG_TYPES = {
  note:     { label: "Note",     color: "#7B8FA1" },
  call:     { label: "Call",     color: "#4A90D9" },
  email:    { label: "Email",    color: "#9B6DD4" },
  meeting:  { label: "Meeting",  color: "#5DB88A" },
  system:   { label: "System",   color: "#C8922A" },
};

async function addLogEntry(projectId, text, type, initials) {
  const id = projectId + "_log_" + Date.now();
  await supabase.from("po_activity").insert([{
    id, project_id: projectId, text, type: type || "note",
    initials: initials || "—",
  }]);
  return { id, text, type: type || "note", initials: initials || "—", created_at: new Date().toISOString(), daysAgo: 0 };
}

async function updateNextAction(projectId, text) {
  await supabase.from("po_projects").update({ next_action: text }).eq("id", projectId);
}

function formatLogDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function LogTab({ project, onUpdate }) {
  const [entries, setEntries] = useState([...(project.activity || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  const [draft, setDraft] = useState("");
  const [entryType, setEntryType] = useState("note");
  const [initials, setInitials] = useState("");
  const [saving, setSaving] = useState(false);
  const [nextAction, setNextAction] = useState(project.nextAction || "");
  const [editingNext, setEditingNext] = useState(false);
  const [nextDraft, setNextDraft] = useState(project.nextAction || "");
  const textRef = React.useRef(null);

  async function submitEntry() {
    if (!draft.trim()) return;
    setSaving(true);
    const entry = await addLogEntry(project.id, draft.trim(), entryType, initials.trim() || "—");
    setEntries(prev => [entry, ...prev]);
    onUpdate(project.id, { activity: [entry, ...(project.activity || [])] });
    setDraft("");
    setSaving(false);
  }

  async function saveNextAction() {
    setNextAction(nextDraft);
    setEditingNext(false);
    await updateNextAction(project.id, nextDraft);
  }

  const typeColor = LOG_TYPES[entryType]?.color || C.muted;

  return (
    <div>
      {/* Next action */}
      <div style={{ marginBottom: "1.5rem", padding: "14px 18px", background: "rgba(200,146,42,0.06)", border: `1px solid rgba(200,146,42,0.25)`, borderRadius: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: C.gold, fontFamily: "monospace", marginBottom: 8 }}>Next action</div>
        {editingNext ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={nextDraft} onChange={e => setNextDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveNextAction(); if (e.key === "Escape") setEditingNext(false); }}
              style={{ ...css.input, flex: 1, fontSize: 13 }} autoFocus
              placeholder="What needs to happen next?" />
            <button style={css.btn("primary")} onClick={saveNextAction}>Save</button>
            <button style={css.btn()} onClick={() => setEditingNext(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => { setNextDraft(nextAction); setEditingNext(true); }}>
            <div style={{ fontSize: 13, color: nextAction ? "#fff" : C.muted, flex: 1, fontStyle: nextAction ? "normal" : "italic" }}>
              {nextAction || "Click to set next action…"}
            </div>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>edit</span>
          </div>
        )}
      </div>

      {/* Entry composer */}
      <div style={{ ...css.card, marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 10 }}>Add entry</div>

        {/* Type selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(LOG_TYPES).filter(([k]) => k !== "system").map(([key, val]) => (
            <div key={key} onClick={() => setEntryType(key)}
              style={{ fontSize: 10, fontWeight: entryType === key ? 700 : 400, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "monospace", border: `1px solid ${entryType === key ? val.color : C.border}`, background: entryType === key ? val.color + "22" : "transparent", color: entryType === key ? val.color : C.muted, transition: "all 0.15s" }}>
              {val.label}
            </div>
          ))}
          <input value={initials} onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="Initials" style={{ ...css.input, width: 72, fontSize: 11, padding: "4px 10px", fontFamily: "monospace", textTransform: "uppercase" }} />
        </div>

        {/* Text area */}
        <textarea ref={textRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitEntry(); }}
          placeholder={`Add a ${LOG_TYPES[entryType]?.label.toLowerCase()} entry… (Cmd+Enter to save)`}
          rows={3} style={{ ...css.input, resize: "vertical", lineHeight: 1.7, fontSize: 13, marginBottom: 10, borderColor: draft ? typeColor + "66" : undefined }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · auto-timestamped
          </div>
          <button style={{ ...css.btn("primary"), opacity: (!draft.trim() || saving) ? 0.5 : 1 }}
            onClick={submitEntry} disabled={!draft.trim() || saving}>
            {saving ? "Saving…" : "Add entry →"}
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {entries.length === 0 && (
          <div style={{ ...css.card, textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No log entries yet. Add your first note above.</div>
          </div>
        )}
        {entries.map((entry, i) => {
          const typeConfig = LOG_TYPES[entry.type] || LOG_TYPES.note;
          const isSystem = entry.type === "system";
          return (
            <div key={entry.id || i} style={{ display: "flex", gap: 0, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              {/* Timeline spine */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0, paddingTop: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: typeConfig.color, border: `2px solid ${typeConfig.color}`, flexShrink: 0 }} />
                {i < entries.length - 1 && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)", marginTop: 4 }} />}
              </div>

              {/* Entry content */}
              <div style={{ flex: 1, padding: "12px 0 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {/* Type badge */}
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: typeConfig.color + "22", color: typeConfig.color, border: `1px solid ${typeConfig.color}44`, fontFamily: "monospace" }}>
                    {typeConfig.label.toUpperCase()}
                  </span>
                  {/* Initials */}
                  {entry.initials && entry.initials !== "—" && (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(74,144,217,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>
                      {entry.initials}
                    </div>
                  )}
                  {/* Timestamp */}
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginLeft: "auto" }}>
                    {formatLogDate(entry.created_at)}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: isSystem ? C.muted : C.text, lineHeight: 1.7, fontStyle: isSystem ? "italic" : "normal", whiteSpace: "pre-wrap" }}>
                  {entry.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PROJECT DETAIL ────────────────────────────────────────────────────────────

function ProjectDetail({ project, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [editingUseCase, setEditingUseCase] = useState(false);
  const [useCaseDraft, setUseCaseDraft] = useState(project.useCase);
  const cfg = STAGE_CONFIG[project.stage];
  const si = stageIndex(project.stage);
  const riskScore = calcRiskScore(project.sourcing);
  const riskColor = riskScore >= 75 ? C.green : riskScore >= 50 ? C.gold : C.red;

  function advanceStage() {
    if (si < STAGES.length - 1) onUpdate(project.id, { stage: STAGES[si + 1] });
  }

  const detailTabs = ["summary", "overview", "requirements", "vendors", "sourcing", "timeline", "approvals", "log"];

  return (
    <div>
      <div onClick={onBack} style={{ fontSize: 12, color: C.muted, cursor: "pointer", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 6 }}
        onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
        ← All projects
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          {editingName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onUpdate(project.id, { name: nameDraft }); updateProjectField(project.id, { name: nameDraft }); setEditingName(false); }
                  if (e.key === "Escape") { setNameDraft(project.name); setEditingName(false); }
                }}
                style={{ ...css.input, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, padding: "4px 10px", flex: 1 }}
                autoFocus
              />
              <button style={css.btn("primary")} onClick={() => { onUpdate(project.id, { name: nameDraft }); updateProjectField(project.id, { name: nameDraft }); setEditingName(false); }}>Save</button>
              <button style={css.btn()} onClick={() => { setNameDraft(project.name); setEditingName(false); }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
              onMouseEnter={e => e.currentTarget.querySelector(".edit-name-btn").style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.querySelector(".edit-name-btn").style.opacity = "0"}>
              <div style={{ ...css.secHead, fontSize: 24 }}>{project.name}</div>
              <button className="edit-name-btn" onClick={() => { setNameDraft(project.name); setEditingName(true); }}
                style={{ ...css.btn(), fontSize: 10, padding: "3px 8px", opacity: 0, transition: "opacity 0.15s" }}>Edit</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{project.dept}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StageBadge stage={project.stage} />
          {si < STAGES.length - 1 && (
            <button style={css.btn("primary")} onClick={advanceStage}>
              Advance to {STAGE_CONFIG[STAGES[si + 1]].label} →
            </button>
          )}
        </div>
      </div>

      <StageProgress current={project.stage} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: "1.5rem" }}>
        {[
          { label: "Budget range", value: project.budgetLow > 0 ? `${fmt(project.budgetLow)} – ${fmt(project.budgetHigh)}` : "TBD" },
          { label: "Category", value: project.category },
          { label: "Requestor", value: project.requestor || "—" },
          { label: "Readiness", value: `${riskScore}%`, color: riskColor },
          { label: "Vendors", value: (project.vendors || []).length },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>{m.label.toUpperCase()}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.color || "#fff" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: "1.5rem", overflowX: "auto", scrollbarWidth: "none" }}>
        {detailTabs.map(t => (
          <div key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", color: activeTab === t ? C.gold : C.muted, borderBottom: activeTab === t ? `2px solid ${C.gold}` : "2px solid transparent", whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0 }}>
            {t}
          </div>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      {activeTab === "summary" && (
        <SummaryTab project={project} riskScore={riskScore} riskColor={riskColor} />
      )}

      {/* ── OVERVIEW ── */}
      {activeTab === "overview" && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 10 }}>Use case</div>
          {editingUseCase ? (
            <div style={{ marginBottom: "1.5rem" }}>
              <textarea value={useCaseDraft} onChange={e => setUseCaseDraft(e.target.value)}
                style={{ ...css.input, minHeight: 90, resize: "vertical", marginBottom: 8, lineHeight: 1.6 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={css.btn("primary")} onClick={() => { onUpdate(project.id, { useCase: useCaseDraft }); updateProjectField(project.id, { useCase: useCaseDraft }); setEditingUseCase(false); }}>Save</button>
                <button style={css.btn()} onClick={() => setEditingUseCase(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ ...css.card, cursor: "pointer", marginBottom: "1.5rem" }} onClick={() => { setUseCaseDraft(project.useCase); setEditingUseCase(true); }}>
              <div style={{ fontSize: 14, color: project.useCase ? C.text : C.muted, lineHeight: 1.7, fontStyle: project.useCase ? "normal" : "italic" }}>
                {project.useCase || "Click to add a use case…"}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>Click to edit</div>
            </div>
          )}

          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 10 }}>Where in the process</div>
          <div style={{ ...css.card, marginBottom: "1.5rem" }}>
            <div style={{ fontSize: 13, color: C.text }}>{project.problemStage || "—"}</div>
          </div>

          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 10 }}>Requirements summary</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {REQ_CATEGORIES.map(r => {
              const req = project.requirements[r.key];
              return (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px" }}>
                  <SDot color={req.status === "confirmed" ? C.green : req.status === "draft" ? C.blue : C.muted} />
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{r.label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 10 }}>Approval chain</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {project.signoffs.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.role}</div>
                  {s.name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.name}</div>}
                </div>
                <SignoffChip status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REQUIREMENTS ── */}
      {activeTab === "requirements" && (
        <RequirementsTab project={project} onUpdate={onUpdate} />
      )}

      {activeTab === "vendors"   && <VendorTab   project={project} onUpdate={onUpdate} />}
      {activeTab === "sourcing"  && <SourcingTab  project={project} onUpdate={onUpdate} />}
      {activeTab === "timeline"  && <TimelineTab  project={project} onUpdate={onUpdate} />}

      {/* ── APPROVALS ── */}
      {activeTab === "approvals" && (
        <ApprovalsTab project={project} onUpdate={onUpdate} />
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === "activity" && (
        <LogTab project={project} onUpdate={onUpdate} />
      )}
    </div>
  );
}

// ── PROJECT LIST ──────────────────────────────────────────────────────────────

function ProjectList({ projects, onOpen, stageFilter, setStageFilter }) {
  const counts = STAGES.reduce((a, s) => ({ ...a, [s]: projects.filter(p => p.stage === s).length }), {});
  const filtered = stageFilter === "all" ? projects : projects.filter(p => p.stage === stageFilter);

  return (
    <>
      <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: "1.5rem" }}>
        {[{ id: "all", label: "All projects", count: projects.length }, ...STAGES.map(s => ({ id: s, label: STAGE_CONFIG[s].label, count: counts[s] }))].map((t, i, arr) => (
          <div key={t.id} onClick={() => setStageFilter(t.id)}
            style={{ flex: 1, padding: "10px 12px", textAlign: "center", cursor: "pointer", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", background: stageFilter === t.id ? C.surface : "rgba(255,255,255,0.02)", transition: "background 0.15s" }}>
            <div style={{ fontSize: 11, color: stageFilter === t.id ? "#fff" : C.muted, fontWeight: stageFilter === t.id ? 700 : 400, fontFamily: "monospace" }}>{t.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>{t.count}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => {
          const cfg = STAGE_CONFIG[p.stage];
          const rs = calcRiskScore(p.sourcing);
          const rc = rs >= 75 ? C.green : rs >= 50 ? C.gold : C.red;
          return (
            <div key={p.id} onClick={() => onOpen(p)}
              style={{ ...css.card, cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{p.dept}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: rc, fontFamily: "monospace", fontWeight: 700 }}>{rs}% ready</span>
                  <StageBadge stage={p.stage} />
                </div>
              </div>
              <ProgressBar pct={cfg.pct} color={cfg.color} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ fontSize: 13, color: C.muted }}>
                  {p.budgetLow > 0
                    ? <span>Budget: <span style={{ color: C.text, fontWeight: 700 }}>{fmt(p.budgetLow)} – {fmt(p.budgetHigh)}</span></span>
                    : <span style={{ fontStyle: "italic" }}>No estimate yet</span>
                  }
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{updatedLabel(p.updatedDaysAgo)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

function Dashboard({ projects }) {
  const total = projects.length;
  const byStage = STAGES.reduce((a, s) => ({ ...a, [s]: projects.filter(p => p.stage === s).length }), {});
  const totalBudget = projects.reduce((a, p) => a + p.budgetHigh, 0);
  const inFlight = projects.filter(p => !["concept", "agreement"].includes(p.stage)).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" }}>
        {[
          { label: "Active projects", value: total },
          { label: "In flight", value: inFlight },
          { label: "Pending approval", value: byStage.approval },
          { label: "Total pipeline value", value: fmt(totalBudget) },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>{m.label.toUpperCase()}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...css.card, marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 16 }}>Pipeline by stage</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
          {STAGES.map(s => {
            const cfg = STAGE_CONFIG[s];
            const count = byStage[s];
            return (
              <div key={s} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 4 }}>{cfg.label}</div>
                <div style={{ height: 3, background: cfg.color + "33", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: total > 0 ? `${(count / total) * 100}%` : "0%", background: cfg.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ ...css.card }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontFamily: "monospace", marginBottom: 16 }}>Recent activity</div>
        {projects.flatMap(p => p.activity.map(a => ({ ...a, projectName: p.name, stage: p.stage }))).sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 8).map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(74,144,217,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.blue, flexShrink: 0, fontFamily: "monospace" }}>{a.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.text }}>{a.text}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                {a.projectName} · <StageBadge stage={a.stage} /> · {updatedLabel(a.daysAgo)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NEW PROJECT MODAL ─────────────────────────────────────────────────────────

function NewProjectModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", requestor: "",
    problemStage: PROBLEM_STAGES[0], useCase: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    if (!form.name.trim()) return;
    const blank = REQ_CATEGORIES.reduce((a, r) => ({ ...a, [r.key]: { text: "", status: "tbd" } }), {});
    onSave({
      id: "p" + Date.now(), stage: "concept", updatedDaysAgo: 0,
      budgetLow: 0, budgetHigh: 0, vendors: [], activity: [], dept: "",
      category: "",
      signoffs: [
        { role: "Requestor", name: form.requestor, status: "required" },
        { role: "Procurement lead", name: "", status: "required" },
        { role: "Director", name: "", status: "required" },
        { role: "Finance", name: "", status: "required" },
      ],
      requirements: blank,
      timeline: blankTimeline(),
      sourcing: blankSourcing(),
      ...form,
    });
  }

  const lbl = (t) => <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4, letterSpacing: 0.5 }}>{t}</div>;

  return (
    <div style={css.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={css.modal}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 20 }}>New project</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>{lbl("PROJECT NAME")}<input style={css.input} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. CRM expansion — sales ops" /></div>
          <div>{lbl("REQUESTOR")}<input style={css.input} value={form.requestor} onChange={e => set("requestor", e.target.value)} placeholder="Name / email" /></div>
          <div>{lbl("WHERE ARE YOU IN THE PROCESS?")}
            <select style={css.select} value={form.problemStage} onChange={e => set("problemStage", e.target.value)}>
              {PROBLEM_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>{lbl("USE CASE — describe the business need in a few sentences")}
            <textarea style={{ ...css.input, minHeight: 80, resize: "vertical", lineHeight: 1.6 }} value={form.useCase} onChange={e => set("useCase", e.target.value)} placeholder="What problem does this solve? Who uses it? What happens if it fails?" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button style={css.btn()} onClick={onClose}>Cancel</button>
          <button style={css.btn("primary")} onClick={save}>Create project →</button>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Overview" },
  { id: "projects",  label: "Projects" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [selectedProject, setSelectedProject] = useState(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [dbStatus, setDbStatus] = useState("loading");

  // Load from Supabase on mount
  useEffect(() => {
    loadAllProjects().then(data => {
      if (data && data.length > 0) {
        setProjects(data);
        setDbStatus("live");
      } else {
        setDbStatus("seed");
      }
    }).catch(() => setDbStatus("error"));
  }, []);

  function updateProject(id, updates) {
    // Optimistic UI
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...updates } : p));
    if (selectedProject?.id === id) setSelectedProject(p => ({ ...p, ...updates }));

    // Auto-log system events
    const systemMessages = [];
    if (updates.stage) systemMessages.push(`Stage changed to ${STAGE_CONFIG[updates.stage]?.label}`);
    if (updates.useCase) systemMessages.push("Use case updated");
    if (updates.vendors) systemMessages.push(`Vendor list updated (${updates.vendors.length} vendor${updates.vendors.length !== 1 ? "s" : ""})`);
    if (updates.signoffs) systemMessages.push("Approval chain updated");
    systemMessages.forEach(msg => {
      addLogEntry(id, msg, "system", "SYS").catch(() => {});
    });

    // Write to Supabase
    if (updates.requirements) {
      const reqs = updates.requirements;
      Object.keys(reqs).forEach(key => {
        updateRequirement(id, key, reqs[key].text, reqs[key].status);
      });
    }
    if (updates.sourcing) {
      const src = updates.sourcing;
      Object.keys(src).forEach(key => {
        updateSourcingItem(id, key, src[key]);
      });
    }
    if (updates.vendors) saveVendors(id, updates.vendors);
    if (updates.signoffs) saveSignoffs(id, updates.signoffs);
    if (updates.timeline) saveTimeline(id, updates.timeline);

    const topLevel = {};
    ["name","stage","useCase","problemStage","budgetLow","budgetHigh","category","requestor"].forEach(f => {
      if (updates[f] !== undefined) topLevel[f] = updates[f];
    });
    if (Object.keys(topLevel).length) updateProjectField(id, topLevel);
  }

  function addProject(proj) {
    setProjects(ps => [proj, ...ps]);
    setShowNew(false);
    setTab("projects");
    setSelectedProject(proj);
    saveNewProject(proj).catch(e => console.warn("save error", e));
  }

  function openProject(p) {
    setSelectedProject(p);
    setTab("projects");
  }

  const syncedProject = selectedProject ? projects.find(p => p.id === selectedProject.id) : null;

  return (
    <div style={css.app}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      <div style={css.header}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={css.wordmark}>PROCUREMENT <span style={{ color: C.gold }}>OS</span></div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, fontFamily: "monospace" }}>PROJECT LIFECYCLE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: 1 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
          </div>
          {dbStatus === "live" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(93,184,138,0.1)", border: "1px solid rgba(93,184,138,0.3)", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: C.green, fontFamily: "monospace" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
              DB LIVE
            </div>
          )}
          {dbStatus === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: C.red, fontFamily: "monospace" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, display: "inline-block" }} />
              DB ERROR
            </div>
          )}
          {dbStatus === "loading" && (
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>CONNECTING…</div>
          )}
          <button style={css.btn("primary")} onClick={() => setShowNew(true)}>+ New project</button>
        </div>
      </div>
      <div style={css.nav}>
        {TABS.map(t => (
          <button key={t.id} style={css.navBtn(tab === t.id)} onClick={() => { setTab(t.id); if (t.id !== "projects") setSelectedProject(null); }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={css.body}>
        {tab === "dashboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div style={css.secHead}>Overview</div>
            </div>
            <Dashboard projects={projects} />
          </>
        )}
        {tab === "projects" && !syncedProject && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div style={css.secHead}>Active projects <span style={{ fontSize: 14, color: C.muted, fontWeight: 400, fontFamily: "monospace" }}>({projects.length})</span></div>
              <button style={css.btn("primary")} onClick={() => setShowNew(true)}>+ New project</button>
            </div>
            <ProjectList projects={projects} onOpen={openProject} stageFilter={stageFilter} setStageFilter={setStageFilter} />
          </>
        )}
        {tab === "projects" && syncedProject && (
          <ProjectDetail project={syncedProject} onBack={() => setSelectedProject(null)} onUpdate={updateProject} />
        )}
      </div>
      {showNew && <NewProjectModal onSave={addProject} onClose={() => setShowNew(false)} />}
    </div>
  );
}
