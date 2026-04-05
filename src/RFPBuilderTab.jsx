import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:         "#0B0B0E",
  surface:    "#111116",
  border:     "rgba(255,255,255,0.07)",
  gold:       "#C8922A",
  goldDim:    "rgba(200,146,42,0.12)",
  goldBorder: "rgba(200,146,42,0.35)",
  text:       "#E2DDD6",
  muted:      "rgba(255,255,255,0.35)",
  green:      "#5DB88A",
  red:        "#E24B4A",
  blue:       "#4A90D9",
};

// ─── PROJECT BRIEF FIELDS (internal only — never surfaces to vendor) ──────────
// These feed all AI generation. Divided into two groups:
//   INTERNAL — captured for AI context, never written into the RFP document
//   VENDOR-FACING — written directly into RFP sections
const BRIEF_FIELDS = [
  {
    key: "category",
    label: "What are you buying?",
    type: "text",
    placeholder: "e.g. AI-enabled visual inspection platform, Enterprise ITSM, SaaS spend management",
    hint: "Be specific about the category. This anchors everything downstream.",
    internal: false,
  },
  {
    key: "current_footprint",
    label: "What does the current state look like?",
    type: "ta",
    placeholder: "e.g. 4 manual QC inspectors per shift across 3 lines. No existing platform. Legacy system on-prem since 2014.",
    hint: "Internal only — never goes to vendor. Captures today's reality so the AI understands context without exposing it.",
    internal: true,
  },
  {
    key: "theoretical_max",
    label: "If everything went right and money was no object — what's the ceiling?",
    type: "ta",
    placeholder: "e.g. 12 production lines across 4 facilities, 200 named users, all product families. That's the universe if this goes company-wide.",
    hint: "This is your scope anchor. Vendors price from the ceiling down — define it before they do.",
    internal: false,
  },
  {
    key: "hard_constraints",
    label: "What are the non-negotiables?",
    type: "ta",
    placeholder: "e.g. Go-live before Q3. Must integrate with SAP. FedRAMP required. No cloud deployment — data stays on-prem.",
    hint: "Hard constraints that any viable vendor must clear. If they can't meet these, they're not a fit.",
    internal: false,
  },
  {
    key: "business_value",
    label: "What does success look like in business terms?",
    type: "ta",
    placeholder: "e.g. Defect escape rate below 0.5%. Audit-defensible license position within 30 days. Zero unplanned downtime in first year.",
    hint: "Not the problem — the return. Quantify it. This is what the overview is built around.",
    internal: false,
  },
  {
    key: "buy_type",
    label: "Is this primarily a software purchase or a services engagement?",
    type: "select",
    options: [
      { value: "",         label: "— Select —" },
      { value: "software", label: "Software / SaaS platform" },
      { value: "services", label: "Professional services engagement" },
      { value: "bundled",  label: "Bundled — software + implementation services" },
      { value: "hardware", label: "Hardware + software (e.g. industrial, IoT)" },
    ],
    hint: "This changes the RFP structure significantly. Conflating software and services is one of the most common failure modes.",
    internal: false,
  },
];

// ─── RFP SECTIONS (vendor-facing document) ────────────────────────────────────
const RFP_SECTIONS = [
  {
    id: "brief", label: "Project Brief", icon: "🧠", isBrief: true,
    tip: "This is your internal intake — it never goes to the vendor. Everything you enter here feeds the AI generation across all other sections. The brief is the engine. Spend time here.",
  },
  {
    id: "cover", label: "Cover & Meta", icon: "📋",
    tip: "The POC structure is a control mechanism. Every vendor touch that bypasses the stated POC is a negotiation integrity violation. Name it explicitly and enforce it.",
    fields: [
      { key: "title",        label: "RFP Title",                                 type: "text", placeholder: "e.g. AI Visual Inspection Platform — RFP 2025" },
      { key: "company",      label: "Issuing Company",                           type: "text", placeholder: "Your company name" },
      { key: "date",         label: "Issue Date",                                type: "text", placeholder: "e.g. April 2025" },
      { key: "poc_sourcing", label: "Sourcing POC (Name / Email / Title)",       type: "text", placeholder: "Jane Smith / jane@co.com / VP Procurement" },
      { key: "poc_dt",       label: "Technical POC (Name / Email / Title)",      type: "text", placeholder: "John Doe / john@co.com / VP Engineering" },
    ],
  },
  {
    id: "overview", label: "Overview & Scope", icon: "🎯", ai: true, aiKey: "overview",
    tip: "Scope quantification, not problem confession. Give vendors what they need to price honestly and self-select. Sites, users, volume, timeline, constraints — nothing about why the current state failed.",
    fields: [
      { key: "overview", label: "Overview", type: "ta", placeholder: "Generated from your Project Brief — or write directly." },
    ],
  },
  {
    id: "requirements", label: "Requirements", icon: "✅", ai: true, aiKey: "requirements", isReqs: true,
    tip: "Everything is a Must. Should and Could are leverage reducers — if you need it, own it. If you're not sure you need it, leave it out entirely. Every requirement must be testable as Met / Not Met.",
  },
  {
    id: "questions", label: "Supplier Questions", icon: "❓", ai: true, aiKey: "questions",
    tip: "Probe how they do the thing, not whether they can. Always ask for a reference who's no longer a customer — that's where the real story is. State your expectations, don't ask if they can meet them. Price questions are scoped and direct.",
    fields: [
      { key: "supplier_questions", label: "Supplier Questions", type: "ta", placeholder: "Generated from your Project Brief — or write directly." },
    ],
  },
  {
    id: "evaluation", label: "Evaluation Criteria", icon: "⚖️", isEval: true,
    tip: "Weights signal priority. Twelve equally weighted criteria tells vendors nothing. Force-rank intentionally — the vendor will optimize accordingly.",
  },
  {
    id: "timeline", label: "Timeline", icon: "📅", isTL: true,
    tip: "Give yourself more time between questions due and responses due than feels necessary. Compressed timelines hurt buyers, not vendors. Vendors have templates. You're building from scratch.",
  },
  {
    id: "response", label: "Response Instructions", icon: "📤",
    tip: "Response format requirements protect the level playing field. Every deviation from format is a signal — either the vendor didn't read carefully, or they're testing your enforcement.",
    fields: [
      { key: "response_format", label: "Format Notes", type: "ta", placeholder: "Any specific format requirements beyond the standard template." },
    ],
  },
];

const CATS = ["Functional", "Technical", "Security", "Integration", "Compliance", "Commercial"];

const DEFAULT_EVAL = [
  { id: "ec1", c: "Proven experience with comparable scope and complexity", w: 25, sel: true  },
  { id: "ec2", c: "Implementation methodology and go-live track record",    w: 20, sel: true  },
  { id: "ec3", c: "Total cost of ownership — year 1 and years 2–3",        w: 25, sel: true  },
  { id: "ec4", c: "Acceptance of master agreement terms",                   w: 15, sel: true  },
  { id: "ec5", c: "Post go-live support model and SLA performance",        w: 15, sel: true  },
  { id: "ec6", c: "Vendor financial stability",                             w:  0, sel: false },
  { id: "ec7", c: "Sustainability and ESG practices",                       w:  0, sel: false },
];

const DEFAULT_TL = [
  { id: "t1", a: "RFP Released",                    d: "" },
  { id: "t2", a: "Supplier Written Questions Due",   d: "" },
  { id: "t3", a: "Company Responses to Questions",   d: "" },
  { id: "t4", a: "RFP Responses Due",                d: "" },
  { id: "t5", a: "Shortlist / Demos",                d: "" },
  { id: "t6", a: "Final Selection / Award Decision", d: "" },
  { id: "t7", a: "Anticipated Go-Live Date",         d: "" },
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  wrap:     { display: "flex", height: "calc(100vh - 160px)", background: C.bg, fontFamily: "'Libre Baskerville', Georgia, serif", color: C.text },
  side:     { width: 220, minWidth: 220, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" },
  sideHdr:  { padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}` },
  sideLbl:  { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 3, fontFamily: "monospace" },
  sideSub:  { fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: "monospace" },
  navList:  { flex: 1, overflowY: "auto", padding: "6px 0" },
  navItem:  (active, done) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer",
    borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent",
    background: active ? C.goldDim : "transparent",
    fontSize: 12, fontFamily: "monospace",
    color: active ? C.text : done ? C.green : C.muted,
    fontWeight: active ? 700 : 400, transition: "all 0.12s",
  }),
  progWrap: { padding: "10px 14px", borderTop: `1px solid ${C.border}` },
  progRow:  { display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted, marginBottom: 5, letterSpacing: 1, fontFamily: "monospace", textTransform: "uppercase" },
  progTrack:{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" },
  main:     { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 },
  secTitle: { fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 7, fontFamily: "monospace" },
  content:  { flex: 1, overflowY: "auto", padding: "20px 24px" },
  draftBar: { display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, flexWrap: "wrap", minHeight: 44 },
  btn: (v = "ghost") => ({
    padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, borderRadius: 5,
    cursor: "pointer", fontFamily: "monospace", transition: "all 0.12s",
    border: v === "primary" ? "none" : v === "danger" ? `1px solid ${C.red}` : v === "ai" ? `1px solid ${C.goldBorder}` : `1px solid ${C.border}`,
    background: v === "primary" ? C.gold : v === "ai" ? C.goldDim : "transparent",
    color: v === "primary" ? "#000" : v === "danger" ? C.red : v === "ai" ? C.gold : C.muted,
    display: "flex", alignItems: "center", gap: 5,
  }),
  draftChip: (active) => ({
    padding: "3px 11px", fontSize: 11, borderRadius: 20, cursor: "pointer", fontFamily: "monospace",
    fontWeight: active ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.12s",
    background: active ? C.goldDim : "transparent",
    border: `1px solid ${active ? C.goldBorder : C.border}`,
    color: active ? C.gold : C.muted,
  }),
  saveStatus: (s) => ({ fontSize: 10, fontFamily: "monospace", letterSpacing: 0.5, marginLeft: "auto", color: s === "saved" ? C.green : s === "saving" ? C.gold : "transparent" }),
  input:    { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 11px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" },
  textarea: { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 11px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 90, lineHeight: 1.6, transition: "border-color 0.15s" },
  select:   { width: "100%", background: "#1a1a20", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 11px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  tip:      { background: "rgba(93,184,138,0.07)", border: `1px solid rgba(93,184,138,0.25)`, borderRadius: 6, padding: "9px 13px", fontSize: 12, color: C.green, lineHeight: 1.5, marginBottom: 16, display: "flex", gap: 8 },
  internalBadge: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.gold, background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 3, padding: "2px 7px", fontFamily: "monospace", marginLeft: 8 },
  hint:     { fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 5, fontStyle: "italic" },
  aiBox:    { background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 6, padding: "11px 13px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" },
  fieldGroup:{ marginBottom: 20 },
  lbl:      { display: "flex", alignItems: "center", fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "monospace" },
  tableWrap:{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  table:    { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th:       { background: C.surface, color: C.muted, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "7px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}`, fontFamily: "monospace" },
  td:       { padding: "7px 10px", borderBottom: `1px solid rgba(255,255,255,0.04)`, color: C.text, fontSize: 12, verticalAlign: "middle" },
  catHdr:   { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase", padding: "14px 0 6px", borderTop: `1px solid ${C.border}`, marginTop: 10, fontFamily: "monospace" },
  addBtn:   { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", fontSize: 11, color: C.muted, background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 5, cursor: "pointer", marginTop: 8, fontFamily: "monospace", transition: "all 0.12s" },
  sel:      { background: "#1a1a20", border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 7px", color: C.text, fontSize: 11, fontFamily: "monospace", outline: "none" },
  spinner:  { display: "inline-block", width: 11, height: 11, border: `1.5px solid rgba(200,146,42,0.3)`, borderTop: `1.5px solid ${C.gold}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  empty:    { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 14 },
  emptyTxt: { fontSize: 13, color: C.muted, fontFamily: "monospace" },
  briefComplete: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(93,184,138,0.07)", border: `1px solid rgba(93,184,138,0.2)`, borderRadius: 6, fontSize: 12, color: C.green, marginBottom: 16, fontFamily: "monospace" },
};

// ─── AI PROMPT BUILDER ────────────────────────────────────────────────────────
// Builds prompts from the Project Brief using the Acuity ruleset:
// - Scope quantification, not problem confession
// - Everything is a Must
// - Questions probe HOW, not WHETHER
// - State expectations, don't ask if they can meet them
// - Never reveal urgency, pain, or internal politics

function buildPrompt(key, rfpData) {
  const category      = rfpData.category        || "[Not specified]";
  const maxScope      = rfpData.theoretical_max  || "[Not specified]";
  const constraints   = rfpData.hard_constraints || "[Not specified]";
  const businessValue = rfpData.business_value   || "[Not specified]";
  const buyType       = rfpData.buy_type         || "software";
  const company       = rfpData.company          || "[Company]";

  // NOTE: current_footprint is intentionally excluded from all vendor-facing prompts.
  // It exists in the brief for AI context only and must never appear in RFP output.

  const context = `
Category: ${category}
Buy type: ${buyType}
Maximum scope (universe if everything goes right): ${maxScope}
Hard constraints (non-negotiables): ${constraints}
Success in business terms: ${businessValue}
Issuing company: ${company}
`.trim();

  const prompts = {

    overview: `You are an expert IT procurement consultant writing a vendor-facing RFP overview section.

CONTEXT (internal — do not reproduce verbatim):
${context}

RULES — follow these exactly:
1. Scope quantification only. Give vendors what they need to price honestly and self-select. Sites, users, volume, timeline, constraints. Nothing else.
2. Never reveal urgency, pain, internal politics, or why the current state failed. That is dirty laundry and it hands leverage to vendors.
3. Never mention the current state, incumbent vendor, or existing problems.
4. Be direct and specific. Vague overviews produce vague proposals.
5. Write in the voice of a company that knows exactly what it wants — not one that needs help figuring it out.
6. Two paragraphs maximum. The first establishes what is being procured and the scope. The second states what a successful outcome looks like in business terms.

Output only the overview text. No headers, no preamble, no bullets.`,

    requirements: `You are an expert IT procurement consultant generating requirements for a vendor-facing RFP.

CONTEXT (internal — do not reproduce verbatim):
${context}

RULES — follow these exactly:
1. Every requirement is a Must. There are no Should or Could. If it is not worth requiring, leave it out entirely. Should/Could reduce leverage by signaling optional value.
2. Every requirement must be binary — testable as Met or Not Met. No aspirational language ("ability to", "should consider", "may support"). If it cannot be tested, it is not a requirement.
3. Every requirement starts with "System must..." or "Vendor must..."
4. Group by category: Functional, Technical, Security, Integration, Compliance, Commercial.
5. 4–6 requirements per category. Only include categories relevant to this purchase.
6. Commercial requirements must be specific. "Vendor must provide fixed-price implementation with milestone-based payment tied to acceptance testing, not delivery" is good. "Pricing must be competitive" is useless.
7. For bundled hardware/software: separate hardware requirements from software requirements. Do not conflate them — this is how scope ambiguity creates erroneous charges.

Output as JSON array only (no markdown, no backticks, no preamble):
[{"category":"Functional","requirement":"System must...","priority":"M"}]`,

    questions: `You are an expert IT procurement consultant generating supplier questions for a vendor-facing RFP.

CONTEXT (internal — do not reproduce verbatim):
${context}

RULES — follow these exactly:
1. Questions probe HOW the vendor does the thing, not WHETHER they can do it. "Describe how your model handles defect types it has not been trained on" is good. "Do you support model retraining?" is useless.
2. Always include one reference question that explicitly asks for a customer who is no longer using the product. That is where the real story is.
3. State pricing expectations directly — do not ask open-ended pricing questions. Example: "Based on the scope described in this RFP, provide a fixed price for implementation and year-one platform costs broken down by: [components]."
4. Never ask questions that will be covered in the master agreement (data retention, SLAs, liability). Those are negotiated in contract, not answered in an RFP.
5. Never ask a question you already know the answer to just to look thorough. Every question should be capable of producing a response that changes your evaluation.
6. Financial health and vendor stability questions belong at the end as a standard template block — flag them with [TEMPLATE] so the buyer knows they are generic.
7. For ${buyType === "bundled" || buyType === "hardware" ? "hardware/software bundled purchases" : "software purchases"}: include at least one question that precisely delineates what is included in the base price vs. what triggers additional charges. Vague scope = erroneous invoices.

Generate 8–10 questions. Number them. Output only the questions, no preamble.`,

  };

  return prompts[key] || "";
}

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

async function dbLoadDrafts() {
  const { data } = await supabase.from("rfp_drafts").select("*").order("updated_at", { ascending: false });
  return data || [];
}

async function dbCreateDraft(title) {
  const id = "rfp_" + Date.now();
  await supabase.from("rfp_drafts").insert([{ id, title }]);
  await supabase.from("rfp_eval_criteria").insert(
    DEFAULT_EVAL.map((e, i) => ({ id: id + "_" + e.id, draft_id: id, criterion: e.c, weight: e.w, selected: e.sel, sort_order: i }))
  );
  await supabase.from("rfp_timeline").insert(
    DEFAULT_TL.map((t, i) => ({ id: id + "_" + t.id, draft_id: id, activity: t.a, target_date: "", sort_order: i }))
  );
  return id;
}

async function dbDeleteDraft(id) {
  await supabase.from("rfp_drafts").delete().eq("id", id);
}

async function dbRenameDraft(id, title) {
  await supabase.from("rfp_drafts").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
}

async function dbLoadDraft(draftId) {
  const [{ data: fields }, { data: reqs }, { data: eval_ }, { data: tl }] = await Promise.all([
    supabase.from("rfp_data").select("*").eq("draft_id", draftId),
    supabase.from("rfp_requirements").select("*").eq("draft_id", draftId).order("sort_order"),
    supabase.from("rfp_eval_criteria").select("*").eq("draft_id", draftId).order("sort_order"),
    supabase.from("rfp_timeline").select("*").eq("draft_id", draftId).order("sort_order"),
  ]);
  const rfpData      = (fields || []).reduce((a, f) => ({ ...a, [f.field_key]: f.field_value }), {});
  const requirements = (reqs   || []).map(r => ({ id: r.id, cat: r.category, t: r.requirement, p: r.priority }));
  const evalCriteria = (eval_  || []).length > 0
    ? (eval_ || []).map(e => ({ id: e.id, c: e.criterion, w: e.weight, sel: e.selected }))
    : DEFAULT_EVAL.map(e => ({ ...e }));
  const timeline     = (tl     || []).length > 0
    ? (tl || []).map(t => ({ id: t.id, a: t.activity, d: t.target_date || "" }))
    : DEFAULT_TL.map(t => ({ ...t }));
  return { rfpData, requirements, evalCriteria, timeline };
}

async function dbSaveField(draftId, key, value) {
  await supabase.from("rfp_data").upsert(
    { id: draftId + "_" + key, draft_id: draftId, field_key: key, field_value: value },
    { onConflict: "draft_id,field_key" }
  );
  await supabase.from("rfp_drafts").update({ updated_at: new Date().toISOString() }).eq("id", draftId);
}

async function dbSaveRequirements(draftId, reqs) {
  await supabase.from("rfp_requirements").delete().eq("draft_id", draftId);
  if (reqs.length) {
    await supabase.from("rfp_requirements").insert(
      reqs.map((r, i) => ({ id: r.id, draft_id: draftId, category: r.cat, requirement: r.t, priority: r.p, sort_order: i }))
    );
  }
  await supabase.from("rfp_drafts").update({ updated_at: new Date().toISOString() }).eq("id", draftId);
}

async function dbSaveEval(draftId, criteria) {
  await supabase.from("rfp_eval_criteria").delete().eq("draft_id", draftId);
  if (criteria.length) {
    await supabase.from("rfp_eval_criteria").insert(
      criteria.map((c, i) => ({ id: c.id, draft_id: draftId, criterion: c.c, weight: c.w, selected: c.sel, sort_order: i }))
    );
  }
}

async function dbSaveTimeline(draftId, tl) {
  await supabase.from("rfp_timeline").delete().eq("draft_id", draftId);
  if (tl.length) {
    await supabase.from("rfp_timeline").insert(
      tl.map((t, i) => ({ id: t.id, draft_id: draftId, activity: t.a, target_date: t.d, sort_order: i }))
    );
  }
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function RFPBuilderTab() {
  const [drafts,        setDrafts]        = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [activeSection, setActiveSection] = useState("brief");
  const [rfpData,       setRfpData]       = useState({});
  const [reqs,          setReqs]          = useState([]);
  const [evalData,      setEvalData]      = useState(DEFAULT_EVAL.map(e => ({ ...e })));
  const [tlData,        setTlData]        = useState(DEFAULT_TL.map(t => ({ ...t })));
  const [aiLoading,     setAiLoading]     = useState({});
  const [completed,     setCompleted]     = useState(new Set());
  const [saveStatus,    setSaveStatus]    = useState("idle");
  const [loading,       setLoading]       = useState(true);
  const [renamingId,    setRenamingId]    = useState(null);
  const [renameVal,     setRenameVal]     = useState("");
  const [showNew,       setShowNew]       = useState(false);
  const [newName,       setNewName]       = useState("");

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    dbLoadDrafts().then(data => {
      setDrafts(data);
      if (data.length > 0) loadDraft(data[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function loadDraft(id) {
    setLoading(true);
    setActiveDraftId(id);
    try {
      const { rfpData: d, requirements, evalCriteria, timeline } = await dbLoadDraft(id);
      setRfpData(d);
      setReqs(requirements);
      setEvalData(evalCriteria);
      setTlData(timeline);
      setAiLoading({});
    } catch(e) { console.warn("load error", e); }
    setLoading(false);
  }

  // ── Brief completeness check ───────────────────────────────────────────────
  const briefComplete = BRIEF_FIELDS.every(f => f.type === "select"
    ? rfpData[f.key] && rfpData[f.key] !== ""
    : rfpData[f.key]?.trim()
  );

  const briefFilledCount = BRIEF_FIELDS.filter(f => f.type === "select"
    ? rfpData[f.key] && rfpData[f.key] !== ""
    : rfpData[f.key]?.trim()
  ).length;

  // ── Completion tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const done = new Set();
    if (briefFilledCount >= 4) done.add("brief");
    RFP_SECTIONS.filter(s => !s.isBrief).forEach(s => {
      if      (s.isReqs) { if (reqs.length >= 3) done.add(s.id); }
      else if (s.isEval) { if (evalData.filter(c => c.sel).length >= 3) done.add(s.id); }
      else if (s.isTL)   { if (tlData.filter(t => t.d).length >= 2) done.add(s.id); }
      else               { if (s.fields?.every(f => rfpData[f.key]?.trim())) done.add(s.id); }
    });
    setCompleted(done);
  }, [rfpData, reqs, evalData, tlData, briefFilledCount]);

  const pct = Math.round((completed.size / RFP_SECTIONS.length) * 100);

  // ── Save wrapper ──────────────────────────────────────────────────────────
  const saving = useCallback(async (fn) => {
    if (!activeDraftId) return;
    setSaveStatus("saving");
    try { await fn(); setSaveStatus("saved"); }
    catch(e) { console.warn("save error", e); setSaveStatus("idle"); }
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [activeDraftId]);

  const onFieldChange = useCallback((key, val) => setRfpData(d => ({ ...d, [key]: val })), []);
  const onFieldBlur   = useCallback((key, val) => { if (activeDraftId) saving(() => dbSaveField(activeDraftId, key, val)); }, [activeDraftId, saving]);

  const updateReqs = useCallback((updater) => {
    setReqs(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saving(() => dbSaveRequirements(activeDraftId, next));
      return next;
    });
  }, [activeDraftId, saving]);

  const updateEval = useCallback((updater) => {
    setEvalData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saving(() => dbSaveEval(activeDraftId, next));
      return next;
    });
  }, [activeDraftId, saving]);

  const updateTL = useCallback((updater) => {
    setTlData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saving(() => dbSaveTimeline(activeDraftId, next));
      return next;
    });
  }, [activeDraftId, saving]);

  // ── AI via Supabase Edge Function ─────────────────────────────────────────
  const runAI = useCallback(async (sec) => {
    if (aiLoading[sec.aiKey]) return;
    if (!briefComplete) {
      alert("Complete the Project Brief first — the AI needs it to generate accurate output.");
      return;
    }
    setAiLoading(l => ({ ...l, [sec.aiKey]: true }));

    const prompt = buildPrompt(sec.aiKey, rfpData);
    const CLAUDE_URL = (process.env.REACT_APP_SUPABASE_URL || "") + "/functions/v1/claude-proxy";

    try {
      const res  = await fetch(CLAUDE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text = (data.content || []).map(b => b.text || "").join("").trim();

      if (sec.aiKey === "requirements") {
        try {
          const match  = text.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(match ? match[0] : text);
          updateReqs(prev => [
            ...prev,
            ...parsed.map((r, i) => ({ id: "r" + Date.now() + i, cat: r.category || "Functional", t: r.requirement || "", p: "M" })),
          ]);
        } catch {
          const lines = text.split("\n").filter(l => l.trim().match(/^(System|Vendor) must/i));
          updateReqs(prev => [...prev, ...lines.map((l, i) => ({ id: "r" + Date.now() + i, cat: "Functional", t: l.replace(/^[\d.\-\s]+/, "").trim(), p: "M" }))]);
        }
      } else if (sec.aiKey === "overview") {
        onFieldChange("overview", text);
        onFieldBlur("overview", text);
      } else if (sec.aiKey === "questions") {
        onFieldChange("supplier_questions", text);
        onFieldBlur("supplier_questions", text);
      }
    } catch(e) {
      console.warn("AI error", e);
      alert("AI generation failed — " + e.message);
    }
    setAiLoading(l => ({ ...l, [sec.aiKey]: false }));
  }, [rfpData, aiLoading, briefComplete, onFieldChange, onFieldBlur, updateReqs]);

  // ── Draft management ──────────────────────────────────────────────────────
  async function handleCreate() {
    const title = newName.trim() || "Untitled RFP";
    const id = await dbCreateDraft(title);
    const updated = await dbLoadDrafts();
    setDrafts(updated);
    setNewName(""); setShowNew(false);
    loadDraft(id);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this RFP draft? This cannot be undone.")) return;
    await dbDeleteDraft(id);
    const updated = await dbLoadDrafts();
    setDrafts(updated);
    if (updated.length > 0) loadDraft(updated[0].id);
    else { setActiveDraftId(null); setRfpData({}); setReqs([]); setLoading(false); }
  }

  async function handleRename(id) {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    await dbRenameDraft(id, renameVal.trim());
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, title: renameVal.trim() } : d));
    setRenamingId(null);
  }

  const sec = RFP_SECTIONS.find(s => s.id === activeSection);

  return (
    <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: C.text, background: C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Draft bar */}
      <div style={S.draftBar}>
        <span style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: 1.5, textTransform: "uppercase", marginRight: 2, flexShrink: 0 }}>Drafts:</span>
        {drafts.map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {renamingId === d.id ? (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(d.id); if (e.key === "Escape") setRenamingId(null); }}
                  style={{ ...S.input, width: 150, fontSize: 11, padding: "3px 8px" }} autoFocus />
                <button style={S.btn("primary")} onClick={() => handleRename(d.id)}>Save</button>
                <button style={S.btn()} onClick={() => setRenamingId(null)}>✕</button>
              </div>
            ) : (
              <>
                <span style={S.draftChip(activeDraftId === d.id)} onClick={() => loadDraft(d.id)}>{d.title}</span>
                {activeDraftId === d.id && (
                  <>
                    <button title="Rename" onClick={() => { setRenamingId(d.id); setRenameVal(d.title); }}
                      style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: "1px 3px" }}>✎</button>
                    <button title="Delete" onClick={() => handleDelete(d.id)}
                      style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: "1px 3px" }}>✕</button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
        {showNew ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNew(false); }}
              placeholder="Draft name…"
              style={{ ...S.input, width: 150, fontSize: 11, padding: "3px 8px" }} autoFocus />
            <button style={S.btn("primary")} onClick={handleCreate}>Create</button>
            <button style={S.btn()} onClick={() => setShowNew(false)}>✕</button>
          </div>
        ) : (
          <button style={S.btn()} onClick={() => setShowNew(true)}>+ New draft</button>
        )}
        <span style={S.saveStatus(saveStatus)}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "·"}
        </span>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, gap: 10, color: C.muted, fontFamily: "monospace", fontSize: 12 }}>
          <span style={S.spinner} /> Loading…
        </div>
      )}

      {!loading && !activeDraftId && (
        <div style={S.empty}>
          <div style={S.emptyTxt}>No RFP drafts yet.</div>
          <button style={S.btn("primary")} onClick={() => setShowNew(true)}>+ Create your first RFP draft</button>
        </div>
      )}

      {!loading && activeDraftId && (
        <div style={S.wrap}>
          {/* Sidebar */}
          <div style={S.side}>
            <div style={S.sideHdr}>
              <div style={S.sideLbl}>Procurement OS</div>
              <div style={S.sideSub}>RFP Builder</div>
            </div>
            <div style={S.navList}>
              {RFP_SECTIONS.map(s => (
                <div key={s.id} style={{
                  ...S.navItem(activeSection === s.id, completed.has(s.id)),
                  ...(s.isBrief ? { borderBottom: `1px solid ${C.border}`, marginBottom: 4, paddingBottom: 12 } : {}),
                }} onClick={() => setActiveSection(s.id)}>
                  <span style={{ width: 16, textAlign: "center", fontSize: 12, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {s.isBrief && (
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: briefComplete ? C.green : C.gold }}>
                      {briefFilledCount}/{BRIEF_FIELDS.length}
                    </span>
                  )}
                  {!s.isBrief && completed.has(s.id) && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={S.progWrap}>
              <div style={S.progRow}>
                <span>Completion</span>
                <span style={{ color: pct === 100 ? C.green : C.gold }}>{pct}%</span>
              </div>
              <div style={S.progTrack}>
                <div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 2, transition: "width 0.4s" }} />
              </div>
            </div>
          </div>

          {/* Main */}
          <div style={S.main}>
            <div style={S.topBar}>
              <div style={S.secTitle}>
                <span>{sec?.icon}</span>{sec?.label}
                {sec?.isBrief && <span style={{ fontSize: 9, color: C.gold, fontFamily: "monospace", background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 3, padding: "2px 7px", marginLeft: 4 }}>INTERNAL ONLY</span>}
              </div>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                {reqs.length} req · {evalData.filter(c => c.sel).length} criteria
              </span>
            </div>
            <div style={S.content}>
              {sec?.isBrief && (
                <BriefSection
                  rfpData={rfpData}
                  briefComplete={briefComplete}
                  briefFilledCount={briefFilledCount}
                  onFieldChange={onFieldChange}
                  onFieldBlur={onFieldBlur}
                />
              )}
              {sec && !sec.isBrief && (
                <SectionContent
                  sec={sec} rfpData={rfpData} reqs={reqs} evalData={evalData} tlData={tlData}
                  aiLoading={aiLoading} briefComplete={briefComplete}
                  onFieldChange={onFieldChange} onFieldBlur={onFieldBlur}
                  onRunAI={runAI} onUpdateReqs={updateReqs} onUpdateEval={updateEval} onUpdateTL={updateTL}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROJECT BRIEF SECTION ────────────────────────────────────────────────────
function BriefSection({ rfpData, briefComplete, briefFilledCount, onFieldChange, onFieldBlur }) {
  return (
    <div>
      <div style={{ ...S.tip, background: "rgba(200,146,42,0.07)", border: `1px solid rgba(200,146,42,0.25)`, color: C.gold, marginBottom: 20 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🧠</span>
        <div>
          <strong>This section is internal only.</strong> Nothing you enter here appears in the vendor-facing RFP document. It feeds the AI generation across all other sections — the more specific you are here, the better the output will be everywhere else. Start here before generating anything.
        </div>
      </div>

      {briefComplete && (
        <div style={S.briefComplete}>
          <span>✓</span> Brief complete — AI generation is unlocked across all sections.
        </div>
      )}

      {BRIEF_FIELDS.map(f => (
        <div key={f.key} style={S.fieldGroup}>
          <label style={S.lbl}>
            {f.label}
            {f.internal && <span style={S.internalBadge}>🔒 Internal</span>}
          </label>
          {f.type === "select" ? (
            <select
              style={S.select}
              value={rfpData[f.key] || ""}
              onChange={e => { onFieldChange(f.key, e.target.value); onFieldBlur(f.key, e.target.value); }}
            >
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "ta" ? (
            <textarea
              style={S.textarea}
              placeholder={f.placeholder}
              value={rfpData[f.key] || ""}
              onChange={e => onFieldChange(f.key, e.target.value)}
              onBlur={e => onFieldBlur(f.key, e.target.value)}
              rows={4}
            />
          ) : (
            <input
              style={S.input}
              type="text"
              placeholder={f.placeholder}
              value={rfpData[f.key] || ""}
              onChange={e => onFieldChange(f.key, e.target.value)}
              onBlur={e => onFieldBlur(f.key, e.target.value)}
            />
          )}
          {f.hint && <div style={S.hint}>{f.hint}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── SECTION CONTENT ─────────────────────────────────────────────────────────
function SectionContent({ sec, rfpData, reqs, evalData, tlData, aiLoading, briefComplete, onFieldChange, onFieldBlur, onRunAI, onUpdateReqs, onUpdateEval, onUpdateTL }) {
  return (
    <div>
      {sec.tip && (
        <div style={S.tip}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <div><strong>Acuity Take: </strong>{sec.tip}</div>
        </div>
      )}

      {/* AI not available until brief is complete */}
      {sec.ai && !briefComplete && (
        <div style={{ ...S.aiBox, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>🤖</span>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Complete the <strong style={{ color: C.text }}>Project Brief</strong> first — the AI uses it to generate accurate, scoped output. {BRIEF_FIELDS.length - (Object.keys(rfpData).filter(k => BRIEF_FIELDS.find(f => f.key === k) && rfpData[k]?.trim()).length)} fields remaining.
          </div>
        </div>
      )}

      {sec.ai && briefComplete && (
        <div style={S.aiBox}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.gold, lineHeight: 1.5 }}>
              <strong>AI Assistant</strong> — Generates from your Project Brief using Acuity's RFP framework. Scope not pain. All Musts. Questions that probe how, not whether.
            </div>
            <button style={{ ...S.btn("ai"), marginTop: 8 }} onClick={() => onRunAI(sec)} disabled={aiLoading[sec.aiKey]}>
              {aiLoading[sec.aiKey] ? <><span style={S.spinner} /> Generating…</> : <>✨ Generate</>}
            </button>
          </div>
        </div>
      )}

      {sec.fields?.map(f => (
        <div key={f.key} style={S.fieldGroup}>
          <label style={S.lbl}>{f.label}</label>
          {f.type === "ta"
            ? <textarea style={S.textarea} placeholder={f.placeholder} value={rfpData[f.key] || ""}
                onChange={e => onFieldChange(f.key, e.target.value)}
                onBlur={e => onFieldBlur(f.key, e.target.value)} rows={6} />
            : <input style={S.input} type="text" placeholder={f.placeholder} value={rfpData[f.key] || ""}
                onChange={e => onFieldChange(f.key, e.target.value)}
                onBlur={e => onFieldBlur(f.key, e.target.value)} />
          }
        </div>
      ))}

      {sec.isReqs && <RequirementsSection reqs={reqs} onUpdate={onUpdateReqs} aiLoading={aiLoading["requirements"]} />}
      {sec.isEval && <EvaluationSection evalData={evalData} onUpdate={onUpdateEval} />}
      {sec.isTL   && <TimelineSection   tlData={tlData}   onUpdate={onUpdateTL} />}
    </div>
  );
}

// ─── REQUIREMENTS ─────────────────────────────────────────────────────────────
function RequirementsSection({ reqs, onUpdate, aiLoading }) {
  const byCat = CATS.map(c => ({ c, r: reqs.filter(r => r.cat === c) })).filter(g => g.r.length > 0);
  return (
    <div>
      {reqs.length === 0 && !aiLoading && (
        <div style={{ textAlign: "center", padding: "28px 0", color: C.muted, fontSize: 12, fontFamily: "monospace" }}>
          No requirements yet. Complete the Project Brief, then use AI to generate a first draft.
        </div>
      )}
      {aiLoading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0", gap: 8, color: C.gold, fontSize: 12, fontFamily: "monospace" }}>
          <span style={S.spinner} /> Generating requirements…
        </div>
      )}
      {byCat.map(group => (
        <div key={group.c}>
          <div style={S.catHdr}>{group.c}</div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 50 }}>Pri</th>
                  <th style={S.th}>Requirement</th>
                  <th style={{ ...S.th, width: 110 }}>Category</th>
                  <th style={{ ...S.th, width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {group.r.map(req => (
                  <tr key={req.id}>
                    <td style={S.td}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}`, fontFamily: "monospace" }}>Must</span>
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.input, fontSize: 12, padding: "5px 8px" }} value={req.t}
                        onChange={e => onUpdate(p => p.map(r => r.id === req.id ? { ...r, t: e.target.value } : r))}
                        placeholder="System must…" />
                    </td>
                    <td style={S.td}>
                      <select style={{ ...S.sel, width: "100%" }} value={req.cat}
                        onChange={e => onUpdate(p => p.map(r => r.id === req.id ? { ...r, cat: e.target.value } : r))}>
                        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <button onClick={() => onUpdate(p => p.filter(r => r.id !== req.id))}
                        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <button style={S.addBtn} onClick={() => onUpdate(p => [...p, { id: "r" + Date.now(), cat: "Functional", t: "", p: "M" }])}>
        + Add Requirement
      </button>
    </div>
  );
}

// ─── EVALUATION ───────────────────────────────────────────────────────────────
function EvaluationSection({ evalData, onUpdate }) {
  const total = evalData.filter(c => c.sel).reduce((s, c) => s + (c.w || 0), 0);
  return (
    <div>
      <div style={{ ...S.tip, marginBottom: 14 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚖️</span>
        <div>
          Selected weights total: <strong style={{ color: total === 100 ? C.green : C.gold }}>{total}%</strong>
          {total !== 100 && <span style={{ color: C.muted }}> — adjust to total 100%</span>}
        </div>
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: 36 }}>Use</th>
              <th style={S.th}>Criterion</th>
              <th style={{ ...S.th, width: 80 }}>Weight %</th>
            </tr>
          </thead>
          <tbody>
            {evalData.map(c => (
              <tr key={c.id} style={{ opacity: c.sel ? 1 : 0.4 }}>
                <td style={S.td}>
                  <input type="checkbox" checked={c.sel}
                    onChange={() => onUpdate(p => p.map(x => x.id === c.id ? { ...x, sel: !x.sel } : x))}
                    style={{ accentColor: C.gold, cursor: "pointer" }} />
                </td>
                <td style={S.td}>
                  <input style={{ ...S.input, fontSize: 12, padding: "5px 8px" }} value={c.c}
                    onChange={e => onUpdate(p => p.map(x => x.id === c.id ? { ...x, c: e.target.value } : x))} />
                </td>
                <td style={S.td}>
                  <input type="number" min={0} max={100} value={c.w}
                    onChange={e => onUpdate(p => p.map(x => x.id === c.id ? { ...x, w: parseInt(e.target.value) || 0 } : x))}
                    style={{ ...S.input, fontSize: 12, padding: "5px 8px", width: 60 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={S.addBtn} onClick={() => onUpdate(p => [...p, { id: "ec" + Date.now(), c: "", w: 10, sel: true }])}>
        + Add Criterion
      </button>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function TimelineSection({ tlData, onUpdate }) {
  return (
    <div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Activity</th>
              <th style={{ ...S.th, width: 170 }}>Target Date</th>
            </tr>
          </thead>
          <tbody>
            {tlData.map(t => (
              <tr key={t.id}>
                <td style={S.td}>
                  <input style={{ ...S.input, fontSize: 12, padding: "5px 8px" }} value={t.a}
                    onChange={e => onUpdate(p => p.map(x => x.id === t.id ? { ...x, a: e.target.value } : x))} />
                </td>
                <td style={S.td}>
                  <input style={{ ...S.input, fontSize: 12, padding: "5px 8px" }} value={t.d}
                    placeholder="e.g. May 1, 2025"
                    onChange={e => onUpdate(p => p.map(x => x.id === t.id ? { ...x, d: e.target.value } : x))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={S.addBtn} onClick={() => onUpdate(p => [...p, { id: "t" + Date.now(), a: "", d: "" }])}>
        + Add Milestone
      </button>
    </div>
  );
}
