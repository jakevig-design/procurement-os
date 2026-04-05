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

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
const RFP_SECTIONS = [
  {
    id: "cover", label: "Cover & Meta", icon: "📋",
    tip: "The POC structure is a control mechanism. Every vendor touch that bypasses the stated POC is a negotiation integrity violation. Name it explicitly and enforce it.",
    fields: [
      { key: "title",        label: "RFP Title",                                  type: "text", placeholder: "e.g. Enterprise CRM Platform — RFP 2025" },
      { key: "company",      label: "Issuing Company",                            type: "text", placeholder: "Your company name" },
      { key: "date",         label: "Issue Date",                                 type: "text", placeholder: "e.g. April 2025" },
      { key: "poc_sourcing", label: "Sourcing POC (Name / Email / Title)",        type: "text", placeholder: "Jane Smith / jane@co.com / VP Procurement" },
      { key: "poc_dt",       label: "DT / Technical POC (Name / Email / Title)",  type: "text", placeholder: "John Doe / john@co.com / VP Engineering" },
    ],
  },
  {
    id: "background", label: "Company & Background", icon: "🏢", ai: true, aiKey: "background",
    tip: "Vendors read this section for signals. Be descriptive about context but never reveal urgency, timeline pressure, or budget — those stay in your head.",
    fields: [
      { key: "company_profile",   label: "Company Profile",           type: "ta", placeholder: "Industry, size, geography, core business." },
      { key: "transformation_bg", label: "Transformation Background", type: "ta", placeholder: "What problem are you solving? What does the current state look like?" },
    ],
  },
  {
    id: "overview", label: "Overview & Objectives", icon: "🎯", ai: true, aiKey: "overview",
    tip: "Vague objectives give vendors room to game their responses. Specific objectives force honest proposals.",
    fields: [
      { key: "overview",   label: "RFP Overview",   type: "ta", placeholder: "2–4 sentence summary of the purpose and context of this RFP." },
      { key: "objectives", label: "RFP Objectives", type: "ta", placeholder: "List 3–5 specific, measurable outcomes this process is designed to achieve." },
    ],
  },
  {
    id: "scope", label: "Scope of Work", icon: "🔭", ai: true, aiKey: "scope",
    tip: "The most expensive word in procurement is 'assumed.' Vendors will price scope ambiguity — and they'll price it high.",
    fields: [
      { key: "scope", label: "Scope Definition", type: "ta", placeholder: "What is IN scope and what is explicitly OUT of scope. Call out integration touchpoints, geography, user populations." },
    ],
  },
  {
    id: "requirements", label: "Requirements", icon: "✅", ai: true, aiKey: "requirements", isReqs: true,
    tip: "Binary requirements are your armor. 'Met / Not Met' leaves no room for a vendor to spin a partial capability into a yes.",
  },
  {
    id: "questions", label: "Supplier Questions", icon: "❓", ai: true, aiKey: "questions",
    tip: "The question that makes a vendor's team pause is worth more than ten they answer fluently.",
    fields: [
      { key: "supplier_questions", label: "Questions for Suppliers", type: "ta", placeholder: "Follow-up questions to reveal capability gaps vendors won't volunteer." },
    ],
  },
  {
    id: "evaluation", label: "Evaluation Criteria", icon: "⚖️", isEval: true,
    tip: "Weights signal priority. If you list 12 equally weighted criteria, you've told vendors nothing. Force-rank intentionally.",
  },
  {
    id: "timeline", label: "Timeline", icon: "📅", isTL: true,
    tip: "Give yourself more time between questions due and responses due than you think you need. Compressed timelines hurt buyers, not vendors.",
  },
  {
    id: "response", label: "Response Instructions", icon: "📤",
    tip: "Response format requirements protect the level playing field. Every deviation is a signal — either the vendor didn't read carefully, or they're testing your enforcement.",
    fields: [
      { key: "response_format", label: "Format Notes", type: "ta", placeholder: "Specific format requirements beyond the standard template." },
    ],
  },
];

const CATS = ["Functional", "Technical", "Security", "Integration", "Compliance", "Commercial"];

const DEFAULT_EVAL = [
  { id: "ec1", c: "Proven experience delivering comparable scope", w: 20, sel: true  },
  { id: "ec2", c: "Implementation methodology and best practices", w: 15, sel: true  },
  { id: "ec3", c: "Cost effectiveness and pricing structure",      w: 20, sel: true  },
  { id: "ec4", c: "Acceptance of company master agreement terms",  w: 15, sel: true  },
  { id: "ec5", c: "Approach to innovation and automation",         w: 10, sel: true  },
  { id: "ec6", c: "Talent quality and employee satisfaction",      w: 10, sel: true  },
  { id: "ec7", c: "Sustainability and ESG practices",              w:  5, sel: false },
  { id: "ec8", c: "Volume deviation handling",                     w:  5, sel: false },
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
  wrap:    { display: "flex", height: "calc(100vh - 160px)", background: C.bg, fontFamily: "'Libre Baskerville', Georgia, serif", color: C.text },
  side:    { width: 220, minWidth: 220, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" },
  sideHdr: { padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}` },
  sideLbl: { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 3, fontFamily: "monospace" },
  sideSub: { fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: "monospace" },
  navList: { flex: 1, overflowY: "auto", padding: "6px 0" },
  navItem: (active, done) => ({
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
  main:    { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 },
  secTitle:{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 7, fontFamily: "monospace" },
  content: { flex: 1, overflowY: "auto", padding: "20px 24px" },
  draftBar:{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, flexWrap: "wrap", minHeight: 44 },
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
  tip:      { background: "rgba(93,184,138,0.07)", border: `1px solid rgba(93,184,138,0.25)`, borderRadius: 6, padding: "9px 13px", fontSize: 12, color: C.green, lineHeight: 1.5, marginBottom: 16, display: "flex", gap: 8 },
  aiBox:    { background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 6, padding: "11px 13px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" },
  fieldGroup:{ marginBottom: 16 },
  lbl:      { display: "block", fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5, fontFamily: "monospace" },
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
};

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

async function dbLoadDrafts() {
  const { data } = await supabase.from("rfp_drafts").select("*").order("updated_at", { ascending: false });
  return data || [];
}

async function dbCreateDraft(title) {
  const id = "rfp_" + Date.now();
  await supabase.from("rfp_drafts").insert([{ id, title }]);
  // Seed defaults
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
  const rfpData    = (fields || []).reduce((a, f) => ({ ...a, [f.field_key]: f.field_value }), {});
  const requirements = (reqs  || []).map(r => ({ id: r.id, cat: r.category,  t: r.requirement,  p: r.priority }));
  const evalCriteria = (eval_ || []).length > 0
    ? (eval_ || []).map(e => ({ id: e.id, c: e.criterion, w: e.weight, sel: e.selected }))
    : DEFAULT_EVAL.map(e => ({ ...e }));
  const timeline   = (tl || []).length > 0
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
  const [activeSection, setActiveSection] = useState("cover");
  const [rfpData,       setRfpData]       = useState({});
  const [reqs,          setReqs]          = useState([]);
  const [evalData,      setEvalData]      = useState(DEFAULT_EVAL.map(e => ({ ...e })));
  const [tlData,        setTlData]        = useState(DEFAULT_TL.map(t => ({ ...t })));
  const [aiResults,     setAiResults]     = useState({});
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

  // ── Load draft ────────────────────────────────────────────────────────────
  async function loadDraft(id) {
    setLoading(true);
    setActiveDraftId(id);
    try {
      const { rfpData: d, requirements, evalCriteria, timeline } = await dbLoadDraft(id);
      setRfpData(d);
      setReqs(requirements);
      setEvalData(evalCriteria);
      setTlData(timeline);
      setAiResults({});
    } catch(e) { console.warn("load error", e); }
    setLoading(false);
  }

  // ── Completion tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const done = new Set();
    RFP_SECTIONS.forEach(s => {
      if      (s.isReqs) { if (reqs.length >= 3) done.add(s.id); }
      else if (s.isEval) { if (evalData.filter(c => c.sel).length >= 3) done.add(s.id); }
      else if (s.isTL)   { if (tlData.filter(t => t.d).length >= 2) done.add(s.id); }
      else               { if (s.fields?.every(f => rfpData[f.key]?.trim())) done.add(s.id); }
    });
    setCompleted(done);
  }, [rfpData, reqs, evalData, tlData]);

  const pct = Math.round((completed.size / RFP_SECTIONS.length) * 100);

  // ── Save wrapper ──────────────────────────────────────────────────────────
  const saving = useCallback(async (fn) => {
    if (!activeDraftId) return;
    setSaveStatus("saving");
    try { await fn(); setSaveStatus("saved"); }
    catch(e) { console.warn("save error", e); setSaveStatus("idle"); }
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [activeDraftId]);

  // ── Field handlers ────────────────────────────────────────────────────────
  const onFieldChange = useCallback((key, val) => setRfpData(d => ({ ...d, [key]: val })), []);
  const onFieldBlur   = useCallback((key, val) => { if (activeDraftId) saving(() => dbSaveField(activeDraftId, key, val)); }, [activeDraftId, saving]);

  // ── Structured data updaters ──────────────────────────────────────────────
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

  // ── AI ────────────────────────────────────────────────────────────────────
  const runAI = useCallback(async (sec) => {
    if (aiLoading[sec.aiKey]) return;
    setAiLoading(l => ({ ...l, [sec.aiKey]: true }));
    const ctx = `Company: ${rfpData.company||"[Not specified]"}\nRFP Title: ${rfpData.title||"[Not specified]"}\nBackground: ${rfpData.transformation_bg||"[Not specified]"}\nScope: ${rfpData.scope||"[Not specified]"}`;
    const prompts = {
      background:   `You are an expert IT procurement consultant. Write a concise Company Profile (3-4 sentences) for an enterprise RFP.\nContext:\n${ctx}\nOutput only the text, no preamble.`,
      overview:     `You are an expert IT procurement consultant. Write a crisp RFP Overview (3-4 sentences) and 4-5 clear RFP Objectives (numbered list).\nContext:\n${ctx}\nFormat:\nOVERVIEW:\n[paragraph]\n\nOBJECTIVES:\n1. ...`,
      scope:        `You are an expert IT procurement consultant. Write a precise Scope of Work with explicit IN scope and OUT of scope sections.\nContext:\n${ctx}\nOutput only the scope text.`,
      requirements: `You are an expert IT procurement consultant. Generate structured requirements.\nContext:\n${ctx}\nRules: Binary (Met/Not Met), starts with "System must..." or "Vendor must...", grouped by Functional/Technical/Security/Integration/Commercial, 3-4 per category, mark M (Must-Have) or S (Should-Have).\nOutput as JSON array only (no markdown):\n[{"category":"Functional","requirement":"System must...","priority":"M"}]`,
      questions:    `You are an expert IT procurement consultant. Generate 8-10 targeted supplier questions that reveal capability gaps.\nContext:\n${ctx}\nOutput as a numbered list only.`,
    };
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompts[sec.aiKey] }] }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";

      if (sec.aiKey === "requirements") {
        try {
          const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
          updateReqs(prev => [...prev, ...parsed.map((r, i) => ({ id: "r" + Date.now() + i, cat: r.category || "Functional", t: r.requirement || "", p: r.priority || "M" }))]);
        } catch {
          const lines = text.split("\n").filter(l => l.trim().match(/^(System|Vendor) must/i));
          updateReqs(prev => [...prev, ...lines.map((l, i) => ({ id: "r" + Date.now() + i, cat: "Functional", t: l.trim(), p: "M" }))]);
        }
      } else {
        if (sec.aiKey === "overview") {
          const om = text.match(/OVERVIEW:\s*([\s\S]*?)\s*OBJECTIVES:/i);
          const obm = text.match(/OBJECTIVES:\s*([\s\S]*)/i);
          if (om)  { onFieldChange("overview",   om[1].trim());  onFieldBlur("overview",   om[1].trim()); }
          if (obm) { onFieldChange("objectives", obm[1].trim()); onFieldBlur("objectives", obm[1].trim()); }
        } else if (sec.aiKey === "background") {
          onFieldChange("company_profile", text.trim()); onFieldBlur("company_profile", text.trim());
        } else if (sec.aiKey === "scope") {
          onFieldChange("scope", text.trim()); onFieldBlur("scope", text.trim());
        } else if (sec.aiKey === "questions") {
          onFieldChange("supplier_questions", text.trim()); onFieldBlur("supplier_questions", text.trim());
        }
        setAiResults(r => ({ ...r, [sec.aiKey]: text }));
      }
    } catch(e) { console.warn("AI error", e); }
    setAiLoading(l => ({ ...l, [sec.aiKey]: false }));
  }, [rfpData, aiLoading, onFieldChange, onFieldBlur, updateReqs]);

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

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, gap: 10, color: C.muted, fontFamily: "monospace", fontSize: 12 }}>
          <span style={S.spinner} /> Loading…
        </div>
      )}

      {/* No drafts */}
      {!loading && !activeDraftId && (
        <div style={S.empty}>
          <div style={S.emptyTxt}>No RFP drafts yet.</div>
          <button style={S.btn("primary")} onClick={() => setShowNew(true)}>+ Create your first RFP draft</button>
        </div>
      )}

      {/* Main layout */}
      {!loading && activeDraftId && (
        <div style={S.wrap}>

          {/* Sidebar nav */}
          <div style={S.side}>
            <div style={S.sideHdr}>
              <div style={S.sideLbl}>Procurement OS</div>
              <div style={S.sideSub}>RFP Builder</div>
            </div>
            <div style={S.navList}>
              {RFP_SECTIONS.map(s => (
                <div key={s.id} style={S.navItem(activeSection === s.id, completed.has(s.id))} onClick={() => setActiveSection(s.id)}>
                  <span style={{ width: 16, textAlign: "center", fontSize: 12, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {completed.has(s.id) && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
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

          {/* Content */}
          <div style={S.main}>
            <div style={S.topBar}>
              <div style={S.secTitle}><span>{sec?.icon}</span>{sec?.label}</div>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                {reqs.length} req · {evalData.filter(c => c.sel).length} criteria
              </span>
            </div>
            <div style={S.content}>
              {sec && (
                <SectionContent
                  sec={sec} rfpData={rfpData} reqs={reqs} evalData={evalData} tlData={tlData}
                  aiLoading={aiLoading} onFieldChange={onFieldChange} onFieldBlur={onFieldBlur}
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

// ─── SECTION CONTENT ─────────────────────────────────────────────────────────
function SectionContent({ sec, rfpData, reqs, evalData, tlData, aiLoading, onFieldChange, onFieldBlur, onRunAI, onUpdateReqs, onUpdateEval, onUpdateTL }) {
  return (
    <div>
      {sec.tip && (
        <div style={S.tip}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <div><strong>Acuity Take: </strong>{sec.tip}</div>
        </div>
      )}
      {sec.ai && (
        <div style={S.aiBox}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.gold, lineHeight: 1.5 }}>
              <strong>AI Assistant</strong> — Generate a draft for this section from what you've entered so far.
            </div>
            <button style={{ ...S.btn("ai"), marginTop: 8 }} onClick={() => onRunAI(sec)} disabled={aiLoading[sec.aiKey]}>
              {aiLoading[sec.aiKey] ? <><span style={S.spinner} /> Generating…</> : <>✨ Generate Draft</>}
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
                onBlur={e => onFieldBlur(f.key, e.target.value)} rows={5} />
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
          No requirements yet. Use AI to generate a draft set, or add manually below.
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
                  <th style={{ ...S.th, width: 70 }}>Priority</th>
                  <th style={S.th}>Requirement</th>
                  <th style={{ ...S.th, width: 110 }}>Category</th>
                  <th style={{ ...S.th, width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {group.r.map(req => (
                  <tr key={req.id}>
                    <td style={S.td}>
                      <select style={S.sel} value={req.p}
                        onChange={e => onUpdate(p => p.map(r => r.id === req.id ? { ...r, p: e.target.value } : r))}>
                        <option value="M">Must</option>
                        <option value="S">Should</option>
                        <option value="C">Could</option>
                      </select>
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
