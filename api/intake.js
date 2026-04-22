const { createClient } = require("@supabase/supabase-js");

async function classifyEmail(subject, body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { category: "Other", urgency: "normal", projectType: "other", summary: subject, vendorMentioned: null, flag: null };

  const prompt = `You are a procurement routing assistant. Classify this email from a business user requesting procurement help.

Subject: ${subject}
Body: ${body}

Return ONLY a JSON object with no markdown:
{
  "category": one of ["Software/SaaS", "Professional Services", "Hardware/Infrastructure", "Managed Services", "Marketing", "Facilities", "Other"],
  "urgency": one of ["critical", "high", "normal", "low"],
  "projectType": one of ["new_purchase", "renewal", "other"],
  "summary": "one sentence describing the request",
  "vendorMentioned": "vendor name if mentioned or null",
  "flag": "any red flag like vendor already engaged, escalation needed, or null"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map(b => b.text || "").join("").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error("AI classification failed:", e);
  }
  return { category: "Other", urgency: "normal", projectType: "other", summary: subject, vendorMentioned: null, flag: null };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { from, fromName, subject, text, secret } = req.body;

    // Verify shared secret
    const expectedSecret = process.env.INTAKE_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!from || !subject) {
      return res.status(400).json({ error: "Missing from or subject" });
    }

    // Classify with AI
    const classification = await classifyEmail(subject, text || "");

    // Generate project ID
    const projectId = "p_email_" + Date.now();
    const projectName = subject.replace(/^(re:|fwd?:|fw:)\s*/i, "").trim() || "New intake request";

    // Create project
    const { error: projectError } = await supabase.from("po_projects").insert([{
      id: projectId,
      name: projectName,
      stage: "concept",
      requestor: fromName || from,
      use_case: text || subject,
      category: classification.category,
      channel: classification.projectType === "renewal" ? "renewal" : "other",
      next_action: `Call ${fromName || from} — understand the request`,
      budget_low: 0,
      budget_high: 0,
      dept: "",
      problem_stage: "",
    }]);

    if (projectError) throw new Error(projectError.message);

    // Create log entry
    const logMessage = [
      `Intake received via email from ${fromName || from} (${from})`,
      `Subject: ${subject}`,
      classification.summary ? `AI summary: ${classification.summary}` : null,
      classification.vendorMentioned ? `⚠️ Vendor mentioned: ${classification.vendorMentioned}` : null,
      classification.flag ? `🚩 Flag: ${classification.flag}` : null,
      `Category: ${classification.category} · Urgency: ${classification.urgency} · Type: ${classification.projectType}`,
    ].filter(Boolean).join("\n");

    await supabase.from("po_activity").insert([{
      id: projectId + "_log_0",
      project_id: projectId,
      initials: "AI",
      text: logMessage,
      type: "system",
    }]);

    // Create blank requirements
    const reqKeys = ["functional", "scale", "integration", "risk", "security", "commercial"];
    await supabase.from("po_requirements").insert(
      reqKeys.map(k => ({
        id: projectId + "_req_" + k,
        project_id: projectId,
        key: k,
        text: "",
        status: "tbd",
      }))
    );

    // Create sourcing checklist
    const srcKeys = ["nda", "masterAgreement", "commodity", "licenseModel", "competitiveBid", "riskAssessment", "securityReview", "legalReview"];
    await supabase.from("po_sourcing").insert(
      srcKeys.map(k => ({
        id: projectId + "_src_" + k,
        project_id: projectId,
        key: k,
        status: "required",
      }))
    );

    return res.status(200).json({
      success: true,
      projectId,
      projectName,
      classification,
    });

  } catch (err) {
    console.error("Intake error:", err);
    return res.status(500).json({ error: err.message });
  }
};
