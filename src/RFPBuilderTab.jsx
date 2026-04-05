/**
 * RFPBuilderTab.jsx
 * Drop this component into Procurement OS as a new tab.
 * Usage: import RFPBuilderTab from './RFPBuilderTab';
 *        Then add { id: "rfp", label: "RFP Builder" } to your TABS array
 *        and render <RFPBuilderTab /> in the tab body switcher.
 *
 * Requires: React, useState, useEffect, useRef (all from 'react')
 * AI features call the Anthropic API via /api/claude proxy (same as existing Prospect Writer)
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME (matches Acuity Sourcing Slate + Warm Gold palette) ────────────────
const C = {
  bg:       "#1A1D21",
  surface:  "#22262C",
  card:     "#2A2F37",
  border:   "#343B44",
  gold:     "#C8922A",
  goldDim:  "rgba(200,146,42,0.15)",
  goldBorder:"rgba(200,146,42,0.35)",
  text:     "#E8E4DC",
  muted:    "#7A8490",
  success:  "#5DB88A",
  warn:     "#E8A84A",
  danger:   "#C0504D",
  blue:     "#4A90D9",
};

// ─── RFP SECTION DEFINITIONS (mirrors the template structure) ─────────────────
const RFP_SECTIONS = [
  {
    id: "cover",
    label: "Cover & Meta",
    icon: "📋",
    fields: [
      { key: "title",       label: "RFP Title",              type: "text",     placeholder: "e.g. Enterprise CRM Platform — RFP 2025" },
      { key: "company",     label: "Issuing Company",        type: "text",     placeholder: "Your company name" },
      { key: "date",        label: "Issue Date",             type: "text",     placeholder: "e.g. April 2025" },
      { key: "poc_sourcing",label: "Sourcing Owner (Name / Email / Title)", type: "text", placeholder: "Jane Smith / jane@co.com / VP Procurement" },
      { key: "poc_dt",      label: "DT / Technical Owner (Name / Email / Title)", type: "text", placeholder: "John Doe / john@co.com / VP Engineering" },
    ]
  },
  {
    id: "background",
    label: "Company & Background",
    icon: "🏢",
    aiEnabled: true,
    aiPromptKey: "background",
    fields: [
      { key: "company_profile",    label: "Company Profile",            type: "textarea", placeholder: "Brief description of your company — industry, size, geography, core business." },
      { key: "transformation_bg",  label: "Transformation Background",  type: "textarea", placeholder: "What is driving this purchase? What problem are you solving? What does the current state look like?" },
    ]
  },
  {
    id: "overview",
    label: "Overview & Objectives",
    icon: "🎯",
    aiEnabled: true,
    aiPromptKey: "overview",
    fields: [
      { key: "overview",    label: "RFP Overview",    type: "textarea", placeholder: "Summarize the overall purpose and context of this RFP in 2–4 sentences." },
      { key: "objectives",  label: "RFP Objectives",  type: "textarea", placeholder: "List 3–5 specific outcomes this RFP process is designed to achieve." },
    ]
  },
  {
    id: "scope",
    label: "Scope of Work",
    icon: "🔭",
    aiEnabled: true,
    aiPromptKey: "scope",
    fields: [
      { key: "scope", label: "Scope Definition", type: "textarea", placeholder: "Define the full scope of work and services being requested. Be explicit about what is IN scope and what is OUT of scope." },
    ]
  },
  {
    id: "requirements",
    label: "Requirements",
    icon: "✅",
    aiEnabled: true,
    aiPromptKey: "requirements",
    isRequirements: true,
    fields: []
  },
  {
    id: "questions",
    label: "Supplier Questions",
    icon: "❓",
    aiEnabled: true,
    aiPromptKey: "questions",
    fields: [
      { key: "supplier_questions", label: "Questions for Suppliers", type: "textarea", placeholder: "Follow-up questions to clarify requirements, request case studies, references, or methodology descriptions." },
    ]
  },
  {
    id: "evaluation",
    label: "Evaluation Criteria",
    icon: "⚖️",
    isEvaluation: true,
    fields: []
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: "📅",
    isTimeline: true,
    fields: []
  },
  {
    id: "response",
    label: "Response Instructions",
    icon: "📤",
    fields: [
      { key: "response_format", label: "Response Format Notes", type: "textarea", placeholder: "Any specific format requirements beyond the standard template (e.g., pricing spreadsheet format, required certifications, page limits)." },
    ]
  },
];

const EVAL_CRITERIA_DEFAULT = [
  { id: "ec1", criterion: "Proven experience delivering comparable scope and scale", weight: 20, selected: true },
  { id: "ec2", criterion: "Implementation methodology and best practices", weight: 15, selected: true },
  { id: "ec3", criterion: "Cost effectiveness and pricing structure", weight: 20, selected: true },
  { id: "ec4", criterion: "Acceptance of company master agreement terms", weight: 15, selected: true },
  { id: "ec5", criterion: "Approach to innovation and automation", weight: 10, selected: true },
  { id: "ec6", criterion: "Talent quality and employee satisfaction indicators", weight: 10, selected: true },
  { id: "ec7", criterion: "Sustainability and ESG practices", weight: 10, selected: false },
  { id: "ec8", criterion: "Volume deviation handling approach", weight: 5, selected: false },
];

const TIMELINE_DEFAULT = [
  { id: "t1", activity: "RFP Released",                        date: "" },
  { id: "t2", activity: "Supplier Written Questions Due",       date: "" },
  { id: "t3", activity: "Company Responses to Questions",       date: "" },
  { id: "t4", activity: "RFP Responses Due",                    date: "" },
  { id: "t5", activity: "Shortlist / Demos",                    date: "" },
  { id: "t6", activity: "Final Selection / Award Decision",     date: "" },
  { id: "t7", activity: "Anticipated Go-Live Date",             date: "" },
];

const REQ_CATEGORIES = ["Functional", "Technical", "Security", "Integration", "Compliance", "Commercial"];

// ─── AI PROMPT BUILDERS ───────────────────────────────────────────────────────
function buildAIPrompt(key, rfpData) {
  const context = `
Company: ${rfpData.company || "[Not specified]"}
RFP Title: ${rfpData.title || "[Not specified]"}
Background: ${rfpData.transformation_bg || "[Not specified]"}
Overview: ${rfpData.overview || "[Not specified]"}
Scope: ${rfpData.scope || "[Not specified]"}
`.trim();

  const prompts = {
    background: `You are an expert IT procurement consultant drafting an enterprise RFP. 
Write a concise, professional Company Profile section (3–4 sentences) for the RFP document based on this context:
${context}
Do not use placeholders or brackets. Be direct and concrete. If information is missing, infer reasonably from context.
Output only the company profile paragraph. No preamble.`,

    overview: `You are an expert IT procurement consultant. 
Write a crisp, executive-level RFP Overview (3–4 sentences) and 4–5 clear RFP Objectives (as a numbered list) based on:
${context}
Be specific, not generic. Each objective should be actionable and measurable.
Format: 
OVERVIEW:
[paragraph]

OBJECTIVES:
1. [objective]
2. [objective]
...`,

    scope: `You are an expert IT procurement consultant.
Write a precise Scope of Work for this RFP. Include what is explicitly IN scope and what is OUT of scope.
Context:
${context}
Be specific. Call out integration touchpoints, geography, user populations, and excluded adjacent systems if inferable.
Output only the scope section text. No preamble.`,

    requirements: `You are an expert IT procurement consultant with 20 years of enterprise software experience.
Generate a structured set of functional and technical requirements for this RFP.
Context:
${context}

Rules:
- Each requirement must be binary (testable as Met / Not Met)
- No vague or aspirational language ("should consider", "ability to")
- Each must start with "System must..." or "Vendor must..."
- Group by category: Functional, Technical, Security, Integration, Commercial
- Generate 4–6 requirements per category
- Mark each as Must-Have (M) or Should-Have (S)

Output as JSON array only (no markdown, no preamble):
[
  {"category": "Functional", "requirement": "System must...", "priority": "M"},
  ...
]`,

    questions: `You are an expert IT procurement consultant.
Generate 8–10 targeted supplier questions for this RFP.
Context:
${context}

Rules:
- Questions should reveal capability gaps vendors won't volunteer
- Include: implementation methodology, reference clients, data migration approach, pricing model transparency, support SLAs, roadmap visibility
- Be direct. Avoid softball questions vendors can dodge with marketing language.

Output as a numbered list. No preamble.`,
  };

  return prompts[key] || "";
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  container: {
    display: "flex",
    height: "calc(100vh - 120px)",
    gap: 0,
    background: C.bg,
    fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
  },
  sidebar: {
    width: 220,
    minWidth: 220,
    background: C.surface,
    borderRight: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "16px 16px 12px",
    borderBottom: `1px solid ${C.border}`,
  },
  sidebarTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sidebarSub: {
    fontSize: 11,
    color: C.gold,
    fontWeight: 600,
  },
  navList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
  },
  navItem: (active, complete) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    cursor: "pointer",
    background: active ? C.goldDim : "transparent",
    borderLeft: active ? `3px solid ${C.gold}` : "3px solid transparent",
    transition: "all 0.15s",
    fontSize: 12,
    color: active ? C.text : complete ? C.success : C.muted,
    fontWeight: active ? 600 : 400,
  }),
  navIcon: { fontSize: 13, width: 18, textAlign: "center" },
  navCheck: { marginLeft: "auto", fontSize: 10, color: C.success },
  progressBar: {
    padding: "12px 16px",
    borderTop: `1px solid ${C.border}`,
  },
  progressLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: C.muted,
    marginBottom: 6,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 3,
    background: C.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    background: C.gold,
    borderRadius: 2,
    transition: "width 0.4s ease",
  }),
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: `1px solid ${C.border}`,
    background: C.surface,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionIcon: { fontSize: 16 },
  actions: { display: "flex", gap: 8, alignItems: "center" },
  btn: (variant = "default") => ({
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    borderRadius: 4,
    border: variant === "primary" ? "none"
          : variant === "ghost"   ? `1px solid ${C.border}`
          : variant === "danger"  ? `1px solid ${C.danger}`
          : variant === "ai"      ? `1px solid ${C.goldBorder}`
          : `1px solid ${C.border}`,
    background: variant === "primary" ? C.gold
              : variant === "ai"      ? C.goldDim
              : "transparent",
    color: variant === "primary" ? "#1A1D21"
         : variant === "danger"  ? C.danger
         : variant === "ai"      ? C.gold
         : C.muted,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 5,
    transition: "all 0.15s",
  }),
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: "9px 12px",
    fontSize: 13,
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  textarea: {
    width: "100%",
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: "10px 12px",
    fontSize: 13,
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: 100,
    lineHeight: 1.6,
    transition: "border-color 0.15s",
  },
  aiBox: {
    background: C.goldDim,
    border: `1px solid ${C.goldBorder}`,
    borderRadius: 6,
    padding: "12px 14px",
    marginBottom: 20,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  aiIcon: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  aiText: { fontSize: 12, color: C.gold, lineHeight: 1.5 },
  aiResult: {
    background: C.card,
    border: `1px solid ${C.goldBorder}`,
    borderRadius: 6,
    padding: 14,
    fontSize: 13,
    color: C.text,
    lineHeight: 1.7,
    marginTop: 10,
    whiteSpace: "pre-wrap",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    background: C.surface,
    color: C.muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: "8px 10px",
    textAlign: "left",
    borderBottom: `1px solid ${C.border}`,
  },
  td: {
    padding: "8px 10px",
    borderBottom: `1px solid ${C.border}`,
    verticalAlign: "middle",
    color: C.text,
    fontSize: 12,
  },
  badge: (type) => ({
    padding: "2px 8px",
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    background: type === "M" ? "rgba(200,146,42,0.15)" : "rgba(74,144,217,0.15)",
    color: type === "M" ? C.gold : C.blue,
    border: `1px solid ${type === "M" ? C.goldBorder : "rgba(74,144,217,0.3)"}`,
  }),
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    fontSize: 11,
    color: C.muted,
    background: "transparent",
    border: `1px dashed ${C.border}`,
    borderRadius: 4,
    cursor: "pointer",
    marginTop: 8,
    width: "100%",
    justifyContent: "center",
    transition: "all 0.15s",
  },
  sectionDivider: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: C.muted,
    textTransform: "uppercase",
    padding: "16px 0 8px",
    borderTop: `1px solid ${C.border}`,
    marginTop: 16,
  },
  coachTip: {
    background: "rgba(93,184,138,0.08)",
    border: `1px solid rgba(93,184,138,0.25)`,
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 12,
    color: "#5DB88A",
    lineHeight: 1.6,
    marginBottom: 18,
    display: "flex",
    gap: 8,
  },
  exportPanel: {
    background: C.surface,
    borderTop: `1px solid ${C.border}`,
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  exportInfo: { fontSize: 11, color: C.muted },
  spinner: {
    display: "inline-block",
    width: 12,
    height: 12,
    border: `2px solid ${C.goldBorder}`,
    borderTop: `2px solid ${C.gold}`,
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
};

// ─── COACHING TIPS ────────────────────────────────────────────────────────────
const COACH_TIPS = {
  cover:       "The POC structure is not administrative — it's a control mechanism. Every vendor touch point that bypasses the stated POC is a negotiation integrity violation. Name it explicitly.",
  background:  "Vendors read this section for signals. Be descriptive about the transformation context but never reveal urgency, timeline pressure, or budget. Those stay in your head.",
  overview:    "Your objectives set the evaluation framework. Vague objectives ('improve efficiency') give vendors room to game their responses. Specific objectives force honest proposals.",
  scope:       "The most expensive word in procurement is 'assumed.' Spell out what's out of scope explicitly. Vendors will price scope ambiguity — and they'll price it high.",
  requirements:"Binary requirements are your armor. 'Met / Not Met' leaves no room for a vendor to spin a partial capability into a yes. Every requirement that isn't binary is a negotiation liability.",
  questions:   "Supplier questions aren't formalities — they're intelligence tools. The question that makes a vendor's team pause is worth more than ten they answer fluently.",
  evaluation:  "Weights signal priority. If you list 12 equally weighted criteria, you've told vendors nothing. Force-rank and weight intentionally. The vendor will optimize accordingly.",
  timeline:    "Give yourself more time between questions due and responses due than you think you need. Compressed timelines hurt buyers, not vendors. Vendors have templates. You're building from scratch.",
  response:    "The response format requirements protect the level playing field. Every deviation from format is a signal — either the vendor didn't read carefully, or they're testing your enforcement.",
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RFPBuilderTab() {
  const [activeSection, setActiveSection] = useState("cover");
  const [rfpData, setRfpData] = useState({});
  const [requirements, setRequirements] = useState([]);
  const [evalCriteria, setEvalCriteria] = useState(EVAL_CRITERIA_DEFAULT);
  const [timeline, setTimeline] = useState(TIMELINE_DEFAULT);
  const [aiResults, setAiResults] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [completedSections, setCompletedSections] = useState(new Set());
  const [exportStatus, setExportStatus] = useState("idle"); // idle | generating | done

  // Track completion
  useEffect(() => {
    const completed = new Set();
    RFP_SECTIONS.forEach(sec => {
      if (sec.isRequirements) {
        if (requirements.length >= 3) completed.add(sec.id);
      } else if (sec.isEvaluation) {
        if (evalCriteria.filter(c => c.selected).length >= 3) completed.add(sec.id);
      } else if (sec.isTimeline) {
        if (timeline.filter(t => t.date).length >= 2) completed.add(sec.id);
      } else {
        const allFilled = sec.fields.every(f => rfpData[f.key]?.trim());
        if (allFilled && sec.fields.length > 0) completed.add(sec.id);
      }
    });
    setCompletedSections(completed);
  }, [rfpData, requirements, evalCriteria, timeline]);

  const completionPct = Math.round((completedSections.size / RFP_SECTIONS.length) * 100);

  // ── Field update ────────────────────────────────────────────────────────────
  const updateField = useCallback((key, val) => {
    setRfpData(d => ({ ...d, [key]: val }));
  }, []);

  // ── AI generation ───────────────────────────────────────────────────────────
  const runAI = useCallback(async (promptKey, onResult) => {
    setAiLoading(l => ({ ...l, [promptKey]: true }));
    try {
      const prompt = buildAIPrompt(promptKey, rfpData);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      onResult(text);
      setAiResults(r => ({ ...r, [promptKey]: text }));
    } catch (e) {
      setAiResults(r => ({ ...r, [promptKey]: "AI generation failed. Please try again." }));
    } finally {
      setAiLoading(l => ({ ...l, [promptKey]: false }));
    }
  }, [rfpData]);

  const generateRequirements = useCallback(async () => {
    await runAI("requirements", (text) => {
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const newReqs = parsed.map((r, i) => ({
          id: `req_${Date.now()}_${i}`,
          category: r.category || "Functional",
          requirement: r.requirement || "",
          priority: r.priority || "M",
          aiGenerated: true,
        }));
        setRequirements(prev => [...prev, ...newReqs]);
      } catch {
        // fallback: parse as text lines
        const lines = text.split("\n").filter(l => l.trim().startsWith("System") || l.trim().startsWith("Vendor"));
        setRequirements(prev => [...prev, ...lines.map((l, i) => ({
          id: `req_txt_${Date.now()}_${i}`,
          category: "Functional",
          requirement: l.trim(),
          priority: "M",
          aiGenerated: true,
        }))]);
      }
    });
  }, [runAI]);

  // ── Requirements CRUD ───────────────────────────────────────────────────────
  const addRequirement = () => {
    setRequirements(prev => [...prev, {
      id: `req_${Date.now()}`,
      category: "Functional",
      requirement: "",
      priority: "M",
      aiGenerated: false,
    }]);
  };
  const updateReq = (id, field, val) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };
  const deleteReq = (id) => {
    setRequirements(prev => prev.filter(r => r.id !== id));
  };

  // ── Eval criteria ────────────────────────────────────────────────────────────
  const toggleEval = (id) => setEvalCriteria(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  const updateEvalWeight = (id, w) => setEvalCriteria(prev => prev.map(c => c.id === id ? { ...c, weight: parseInt(w) || 0 } : c));
  const addEvalCriterion = () => setEvalCriteria(prev => [...prev, { id: `ec_${Date.now()}`, criterion: "", weight: 10, selected: true }]);

  // ── Timeline ─────────────────────────────────────────────────────────────────
  const updateTimeline = (id, val) => setTimeline(prev => prev.map(t => t.id === id ? { ...t, date: val } : t));
  const addTimelineRow = () => setTimeline(prev => [...prev, { id: `t_${Date.now()}`, activity: "", date: "" }]);

  // ── Export (generate summary JSON for download) ──────────────────────────────
  const handleExport = () => {
    setExportStatus("generating");
    setTimeout(() => {
      const rfpDoc = {
        meta: rfpData,
        requirements,
        evalCriteria: evalCriteria.filter(c => c.selected),
        timeline,
        aiContent: aiResults,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(rfpDoc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RFP_${(rfpData.title || "draft").replace(/\s+/g, "_")}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 2000);
    }, 500);
  };

  // ── Section renderer ─────────────────────────────────────────────────────────
  const currentSection = RFP_SECTIONS.find(s => s.id === activeSection);
  const tip = COACH_TIPS[activeSection];

  const renderContent = () => {
    if (!currentSection) return null;

    return (
      <div>
        {/* Coaching tip */}
        {tip && (
          <div style={S.coachTip}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <div><strong style={{ fontWeight: 700 }}>Acuity Take: </strong>{tip}</div>
          </div>
        )}

        {/* AI generation box */}
        {currentSection.aiEnabled && (
          <div style={S.aiBox}>
            <span style={S.aiIcon}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={S.aiText}>
                <strong>AI Assistant</strong> — Generate a draft for this section based on what you've filled in so far. You can edit the output directly below.
              </div>
              <button
                style={{ ...S.btn("ai"), marginTop: 8 }}
                onClick={() => {
                  if (currentSection.isRequirements) {
                    generateRequirements();
                  } else {
                    runAI(currentSection.aiPromptKey, (text) => {
                      // Auto-populate fields from AI output
                      if (currentSection.id === "overview") {
                        const overviewMatch = text.match(/OVERVIEW:\s*([\s\S]*?)\s*OBJECTIVES:/i);
                        const objectivesMatch = text.match(/OBJECTIVES:\s*([\s\S]*)/i);
                        if (overviewMatch) updateField("overview", overviewMatch[1].trim());
                        if (objectivesMatch) updateField("objectives", objectivesMatch[1].trim());
                      } else if (currentSection.id === "background") {
                        updateField("company_profile", text.trim());
                      } else if (currentSection.id === "scope") {
                        updateField("scope", text.trim());
                      } else if (currentSection.id === "questions") {
                        updateField("supplier_questions", text.trim());
                      }
                    });
                  }
                }}
                disabled={aiLoading[currentSection.aiPromptKey] || aiLoading["requirements"]}
              >
                {(aiLoading[currentSection.aiPromptKey] || aiLoading["requirements"])
                  ? <><span style={S.spinner} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style> Generating…</>
                  : <><span>✨</span> Generate Draft</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Standard fields */}
        {currentSection.fields.map(field => (
          <div key={field.key} style={S.fieldGroup}>
            <label style={S.label}>{field.label}</label>
            {field.type === "textarea" ? (
              <textarea
                style={S.textarea}
                placeholder={field.placeholder}
                value={rfpData[field.key] || ""}
                onChange={e => updateField(field.key, e.target.value)}
                rows={5}
                onFocus={e => e.target.style.borderColor = C.gold}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            ) : (
              <input
                style={S.input}
                type="text"
                placeholder={field.placeholder}
                value={rfpData[field.key] || ""}
                onChange={e => updateField(field.key, e.target.value)}
                onFocus={e => e.target.style.borderColor = C.gold}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            )}
          </div>
        ))}

        {/* Requirements section */}
        {currentSection.isRequirements && (
          <RequirementsSection
            requirements={requirements}
            onAdd={addRequirement}
            onUpdate={updateReq}
            onDelete={deleteReq}
            aiLoading={aiLoading["requirements"]}
          />
        )}

        {/* Evaluation criteria section */}
        {currentSection.isEvaluation && (
          <EvaluationSection
            criteria={evalCriteria}
            onToggle={toggleEval}
            onUpdateWeight={updateEvalWeight}
            onAdd={addEvalCriterion}
            onUpdate={(id, val) => setEvalCriteria(prev => prev.map(c => c.id === id ? { ...c, criterion: val } : c))}
          />
        )}

        {/* Timeline section */}
        {currentSection.isTimeline && (
          <TimelineSection
            timeline={timeline}
            onUpdate={updateTimeline}
            onAdd={addTimelineRow}
            onUpdateActivity={(id, val) => setTimeline(prev => prev.map(t => t.id === id ? { ...t, activity: val } : t))}
          />
        )}
      </div>
    );
  };

  return (
    <div style={S.container}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarTitle}>Procurement OS</div>
          <div style={S.sidebarSub}>RFP Builder</div>
        </div>
        <div style={S.navList}>
          {RFP_SECTIONS.map(sec => (
            <div
              key={sec.id}
              style={S.navItem(activeSection === sec.id, completedSections.has(sec.id))}
              onClick={() => setActiveSection(sec.id)}
            >
              <span style={S.navIcon}>{sec.icon}</span>
              <span>{sec.label}</span>
              {completedSections.has(sec.id) && (
                <span style={S.navCheck}>✓</span>
              )}
            </div>
          ))}
        </div>
        <div style={S.progressBar}>
          <div style={S.progressLabel}>
            <span>COMPLETION</span>
            <span style={{ color: completionPct === 100 ? C.success : C.gold }}>{completionPct}%</span>
          </div>
          <div style={S.progressTrack}>
            <div style={S.progressFill(completionPct)} />
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div style={S.main}>
        <div style={S.topBar}>
          <div style={S.sectionTitle}>
            <span style={S.sectionIcon}>{currentSection?.icon}</span>
            {currentSection?.label}
          </div>
          <div style={S.actions}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>
              {requirements.length} req · {evalCriteria.filter(c=>c.selected).length} criteria
            </span>
            <button style={S.btn("primary")} onClick={handleExport}>
              {exportStatus === "generating" ? "Generating…"
               : exportStatus === "done" ? "✓ Exported"
               : "⬇ Export RFP"}
            </button>
          </div>
        </div>

        <div style={S.content}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function RequirementsSection({ requirements, onAdd, onUpdate, onDelete, aiLoading }) {
  const categories = REQ_CATEGORIES;
  const byCategory = categories.map(cat => ({
    cat,
    reqs: requirements.filter(r => r.category === cat),
  })).filter(g => g.reqs.length > 0);

  return (
    <div>
      {byCategory.map(group => (
        <div key={group.cat} style={{ marginBottom: 24 }}>
          <div style={S.sectionDivider}>{group.cat}</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 60 }}>Priority</th>
                <th style={S.th}>Requirement</th>
                <th style={{ ...S.th, width: 110 }}>Category</th>
                <th style={{ ...S.th, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {group.reqs.map(req => (
                <tr key={req.id} style={{ background: req.aiGenerated ? "rgba(200,146,42,0.03)" : "transparent" }}>
                  <td style={S.td}>
                    <select
                      value={req.priority}
                      onChange={e => onUpdate(req.id, "priority", e.target.value)}
                      style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 11, borderRadius: 3, padding: "2px 4px" }}
                    >
                      <option value="M">Must</option>
                      <option value="S">Should</option>
                      <option value="C">Could</option>
                    </select>
                  </td>
                  <td style={S.td}>
                    <input
                      style={{ ...S.input, fontSize: 12, padding: "5px 8px" }}
                      value={req.requirement}
                      onChange={e => onUpdate(req.id, "requirement", e.target.value)}
                      placeholder="System must..."
                    />
                  </td>
                  <td style={S.td}>
                    <select
                      value={req.category}
                      onChange={e => onUpdate(req.id, "category", e.target.value)}
                      style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 11, borderRadius: 3, padding: "2px 4px", width: "100%" }}
                    >
                      {REQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => onDelete(req.id)}
                      style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "2px 4px" }}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {requirements.length === 0 && !aiLoading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>
          No requirements yet. Use AI to generate a draft set, or add manually.
        </div>
      )}

      {aiLoading && (
        <div style={{ textAlign: "center", padding: "24px 0", color: C.gold, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid rgba(200,146,42,0.3)`, borderTop: `2px solid ${C.gold}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Generating requirements…
        </div>
      )}

      <button style={S.addBtn} onClick={onAdd}>
        + Add Requirement
      </button>
    </div>
  );
}

function EvaluationSection({ criteria, onToggle, onUpdateWeight, onAdd, onUpdate }) {
  const selectedWeight = criteria.filter(c => c.selected).reduce((sum, c) => sum + (c.weight || 0), 0);

  return (
    <div>
      <div style={{ ...S.coachTip, marginBottom: 16 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚖️</span>
        <div>
          Selected criteria weights total: <strong style={{ color: selectedWeight === 100 ? C.success : C.warn }}>{selectedWeight}%</strong>
          {selectedWeight !== 100 && <span style={{ color: C.muted }}> — adjust weights to total 100%</span>}
        </div>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 40 }}>Use</th>
            <th style={S.th}>Criterion</th>
            <th style={{ ...S.th, width: 80 }}>Weight %</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map(c => (
            <tr key={c.id} style={{ opacity: c.selected ? 1 : 0.45 }}>
              <td style={S.td}>
                <input
                  type="checkbox"
                  checked={c.selected}
                  onChange={() => onToggle(c.id)}
                  style={{ accentColor: C.gold, cursor: "pointer" }}
                />
              </td>
              <td style={S.td}>
                <input
                  style={{ ...S.input, fontSize: 12, padding: "5px 8px" }}
                  value={c.criterion}
                  onChange={e => onUpdate(c.id, e.target.value)}
                />
              </td>
              <td style={S.td}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={c.weight}
                  onChange={e => onUpdateWeight(c.id, e.target.value)}
                  style={{ ...S.input, fontSize: 12, padding: "5px 8px", width: 60 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={S.addBtn} onClick={onAdd}>+ Add Criterion</button>
    </div>
  );
}

function TimelineSection({ timeline, onUpdate, onAdd, onUpdateActivity }) {
  return (
    <div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Activity</th>
            <th style={{ ...S.th, width: 160 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map(t => (
            <tr key={t.id}>
              <td style={S.td}>
                <input
                  style={{ ...S.input, fontSize: 12, padding: "5px 8px" }}
                  value={t.activity}
                  onChange={e => onUpdateActivity(t.id, e.target.value)}
                />
              </td>
              <td style={S.td}>
                <input
                  type="text"
                  placeholder="e.g. April 14, 2025"
                  style={{ ...S.input, fontSize: 12, padding: "5px 8px" }}
                  value={t.date}
                  onChange={e => onUpdate(t.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={S.addBtn} onClick={onAdd}>+ Add Milestone</button>
    </div>
  );
}
