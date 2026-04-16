import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Trash2, Loader, ChevronRight, CheckCircle, Pencil, X, Check, RefreshCw, AlertTriangle, Calendar, Save, Clock, ArrowLeft, ChevronDown, ChevronUp, GripVertical, ThumbsUp, ThumbsDown } from "lucide-react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, LevelFormat } from "docx";
import { saveSession, loadSessions, loadSession, deleteSession, signIn, signUp, signOut, getSession, onAuthStateChange, loadUserProfile, saveUserProfile, logEvent } from "./supabase";
import { P_SCOPE_CHAT, P_SCOPE_GENERATE, P_SCOPE_EVALUATE, P_SCOPE_REFINE, P_SCOPE_EXPERT, P_REQS, P_QS, P_MARKET, P_NARRATIVE, FIVE_WS } from "./prompts";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const _link = document.createElement("link");
_link.rel = "stylesheet";
_link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap";
_link.media = "print";
_link.onload = function(){ this.media = "all"; };
const _preconn = document.createElement("link");
_preconn.rel = "preconnect";
_preconn.href = "https://fonts.googleapis.com";
document.head.insertBefore(_preconn, document.head.firstChild);
document.head.appendChild(_link);

// ─── Palette tokens ───────────────────────────────────────────────────────────
// A3 Light Professional theme
// Background:  #F9F8F8   Sidebar/card: #FFFFFF
// Accent:      #C2410C   Amber:        #D97706
// Body text:   #111827   Muted:        #6B7280
// Border:      rgba(0,0,0,0.07)

const _style = document.createElement("style");
_style.textContent = `
  *{box-sizing:border-box}
  .rq-root{font-family:'Lora',Georgia,serif;background:#F9F8F8;min-height:100vh;color:#111827;display:flex;flex-direction:column}

  /* ── Dashboard layout ── */
  .rq-shell{display:flex;flex:1;min-height:0}
  .rq-sidebar{width:200px;flex-shrink:0;background:#FFFFFF;border-right:1px solid rgba(0,0,0,0.07);display:flex;flex-direction:column;padding:0;transition:transform .2s}
  .rq-sidebar-logo{padding:16px 20px;border-bottom:1px solid rgba(0,0,0,0.07)}
  .rq-sidebar-brand{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#C2410C;margin-bottom:2px}
  .rq-sidebar-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#111827}
  .rq-sidebar-session{font-family:'JetBrains Mono',monospace;font-size:9px;color:#9CA3AF;margin-top:4px}
  .rq-nav{padding:12px 0;flex:1;overflow-y:auto}
  .rq-nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;font-family:'Syne',sans-serif;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;border-left:2px solid transparent;cursor:pointer;transition:all .15s}
  .rq-nav-item:hover{color:#374151;background:rgba(0,0,0,0.03)}
  .rq-nav-item.active{color:#C2410C;border-left-color:#C2410C;background:#FFF7ED}
  .rq-nav-item.done{color:#6B7280}
  .rq-nav-item.done .rq-nav-num{background:#FFF7ED;border-color:#FDBA74;color:#C2410C}
  .rq-nav-num{width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
  .rq-sidebar-footer{padding:16px 20px;border-top:1px solid rgba(0,0,0,0.07)}

  /* ── Main content area ── */
  .rq-main{flex:1;display:flex;flex-direction:column;min-width:0}
  .rq-topbar{background:#FFFFFF;border-bottom:1px solid rgba(0,0,0,0.07);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:10px}
  .rq-topbar-left .rq-topbar-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#111827}
  .rq-topbar-left .rq-topbar-sub{font-size:11px;color:#6B7280;margin-top:2px}
  .rq-topbar-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .rq-save-chip{font-family:'JetBrains Mono',monospace;font-size:10px;color:#C2410C;background:#FFF7ED;padding:4px 10px;border-radius:3px;display:flex;align-items:center;gap:5px}
  .rq-export-btn{display:flex;align-items:center;gap:7px;background:#C2410C;color:#FFFFFF;font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;border:none;border-radius:4px;cursor:pointer;transition:background .15s;white-space:nowrap}
  .rq-export-btn:hover{background:#9A3412}
  .rq-export-btn:disabled{opacity:.4;cursor:not-allowed}
  .rq-content{flex:1;padding:28px 32px;overflow-y:auto}

  /* ── Metric cards ── */
  .rq-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
  .rq-metric{background:#FFFFFF;border-radius:6px;padding:12px 14px;border:1px solid rgba(0,0,0,0.07);text-align:center}
  .rq-metric-label{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px}
  .rq-metric-val{font-size:22px;font-weight:500;color:#111827}
  .rq-metric-sub{font-size:10px;color:#C2410C;margin-top:2px}
  .rq-metric-sub.amber{color:#D97706}

  /* ── Section label ── */
  .rq-section-label{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px}

  /* ── Cards / panels ── */
  .rq-card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:18px 20px;margin-bottom:10px}
  .rq-card:hover{border-color:rgba(194,65,12,0.3)}

  /* ── Form elements ── */
  .rq-textarea{width:100%;border:1px solid rgba(0,0,0,0.12);border-radius:6px;padding:12px 14px;font-family:'Lora',serif;font-size:14px;color:#111827;background:#FFFFFF;resize:vertical;min-height:80px;outline:none;transition:border-color .15s;line-height:1.65}
  .rq-textarea:focus{border-color:#C2410C}
  .rq-input{width:100%;border:1px solid rgba(0,0,0,0.12);border-radius:6px;padding:9px 12px;font-family:'Lora',serif;font-size:13px;color:#111827;background:#FFFFFF;outline:none;transition:border-color .15s}
  .rq-input:focus{border-color:#C2410C}

  /* ── Buttons ── */
  .rq-btn-primary{display:inline-flex;align-items:center;gap:7px;background:#C2410C;color:#FFFFFF;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;transition:background .15s}
  .rq-btn-primary:hover{background:#9A3412}
  .rq-btn-primary:disabled{opacity:.4;cursor:not-allowed}
  .rq-btn-ghost{display:inline-flex;align-items:center;gap:6px;background:transparent;color:#6B7280;font-family:'Syne',sans-serif;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:8px 12px;border:1px solid rgba(0,0,0,0.12);border-radius:4px;cursor:pointer;transition:all .15s}
  .rq-btn-ghost:hover{border-color:#C2410C;color:#C2410C}
  .rq-btn-ghost:disabled{opacity:.4;cursor:not-allowed}
  .rq-btn-icon{display:inline-flex;align-items:center;justify-content:center;background:transparent;padding:5px 7px;border:1px solid rgba(0,0,0,0.1);border-radius:4px;cursor:pointer;transition:all .15s;color:#6B7280}
  .rq-btn-icon:hover{border-color:#C2410C;color:#C2410C}
  .rq-btn-icon:disabled{opacity:.35;cursor:not-allowed}
  .rq-btn-del{color:#DC2626;border-color:rgba(220,38,38,0.3)}
  .rq-btn-del:hover{background:rgba(220,38,38,0.06);color:#DC2626}

  /* ── Req cards ── */
  .rq-req-id{font-family:'JetBrains Mono',monospace;font-size:10px;color:#C2410C;font-weight:500;margin-bottom:4px;background:#FFF7ED;display:inline-block;padding:1px 6px;border-radius:2px;border:1px solid #FDBA74}
  .rq-req-text{font-size:13px;line-height:1.55;color:#374151;margin-top:4px}

  /* ── Q cards ── */
  .rq-q-card{border:1px solid rgba(0,0,0,0.07);border-radius:6px;padding:14px 16px;margin-bottom:8px;background:#FFFFFF}
  .rq-badge{display:inline-block;font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:3px;margin-bottom:6px}
  .rq-badge-open{background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74}
  .rq-badge-mc{background:#FFFBEB;color:#D97706;border:1px solid #FCD34D}
  .rq-q-text{font-size:13px;color:#374151;line-height:1.5}
  .rq-mc-opts{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
  .rq-mc-opt{font-family:'JetBrains Mono',monospace;font-size:11px;background:#FFFBEB;border:1px solid rgba(217,119,6,0.3);border-radius:3px;padding:3px 9px;color:#D97706}

  /* ── Scope ── */
  .rq-scope-box{font-size:14px;line-height:1.75;color:#374151;background:#F9F8F8;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:16px 20px;white-space:pre-wrap;font-family:'Lora',serif}
  .rq-scope-approved{background:#FFF7ED;border:1px solid rgba(194,65,12,0.3);border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C2410C}
  .rq-flag-card{background:#FFFBEB;border:1px solid rgba(217,119,6,0.3);border-radius:8px;padding:14px 18px;margin-bottom:12px}
  .rq-flag-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#D97706;margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .rq-flag-text{font-size:13px;color:#92400E;line-height:1.6;margin-bottom:10px}

  /* ── 5Ws ── */
  .rq-5w-card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:18px 20px;margin-bottom:12px}
  .rq-5w-label{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#C2410C;margin-bottom:4px}
  .rq-5w-question{font-size:13px;font-weight:500;color:#111827;margin-bottom:10px;font-family:'Syne',sans-serif}

  /* ── Save bar ── */
  .sv-bar{display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:6px;padding:8px 14px;margin-bottom:20px;gap:12px}
  .sv-status{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9CA3AF;display:flex;align-items:center;gap:6px}
  .sv-status.saved{color:#C2410C}
  .sv-status.saving{color:#D97706}
  .sv-status.error{color:#DC2626}

  /* ── Progress ── */
  .rq-progress{display:flex;align-items:center;gap:10px;margin-bottom:28px}

  /* ── Step progress bar ── */
  .rq-step-bar{display:flex;align-items:center;gap:0;padding:10px 20px;background:#FFFFFF;border-bottom:1px solid rgba(0,0,0,0.05);overflow-x:auto;flex-shrink:0}
  .rq-step-item{display:flex;align-items:center;gap:0;flex-shrink:0}
  .rq-step-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:9px;font-weight:700;flex-shrink:0;transition:all .2s}
  .rq-step-dot.done{background:#FFF7ED;color:#C2410C;border:1.5px solid #FDBA74}
  .rq-step-dot.active{background:#C2410C;color:#FFFFFF;border:1.5px solid #C2410C}
  .rq-step-dot.locked{background:#F3F4F6;color:#D1D5DB;border:1.5px solid #E5E7EB}
  .rq-step-label{font-family:'Syne',sans-serif;font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-left:6px;white-space:nowrap}
  .rq-step-label.done{color:#C2410C}
  .rq-step-label.active{color:#111827}
  .rq-step-label.locked{color:#D1D5DB}
  .rq-step-connector{width:20px;height:1px;background:#E5E7EB;margin:0 4px;flex-shrink:0}
  .rq-step-connector.done{background:#FDBA74}

  /* ── Mobile viewport fix for chat keyboard ── */
  @supports(height: 100dvh){
    .rq-root{min-height:100dvh}
  }
  .rq-pb-wrap{flex:1;height:3px;background:rgba(0,0,0,0.06);border-radius:2px;overflow:hidden}
  .rq-pb{height:100%;background:#C2410C;border-radius:2px;transition:width .5s ease}
  .rq-pb-label{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9CA3AF;white-space:nowrap}

  /* ── Misc ── */
  .rq-hint{font-size:13px;color:#9CA3AF;line-height:1.6;font-style:italic;margin:0 0 16px}
  .rq-error{background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.25);border-radius:6px;padding:10px 14px;font-size:13px;color:#DC2626;margin-top:10px}
  .rq-divider{border:none;border-top:1px solid rgba(0,0,0,0.07);margin:24px 0}
  .rq-row{display:flex;gap:8px;align-items:center}
  .rq-actions{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}
  .rq-req-group-label{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;color:#374151;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.07)}
  .rq-loading-center{padding:36px 0;text-align:center;color:#9CA3AF;font-style:italic;font-family:'Lora',serif}

  /* ── Projects ── */
  .sessions-panel{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:8px;overflow:hidden;margin-bottom:24px}
  .sessions-header{padding:12px 18px;border-bottom:1px solid rgba(0,0,0,0.07);background:#F9F8F8}
  .sessions-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#9CA3AF}
  .session-row{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer;transition:background .15s;gap:12px}
  .session-row:last-child{border-bottom:none}
  .session-row:hover{background:#F9F8F8}
  .session-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:#111827;margin-bottom:2px}
  .session-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9CA3AF}
  .session-status{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:3px}
  .session-status.draft{background:#FFFBEB;color:#D97706}
  .session-status.complete{background:#FFF7ED;color:#C2410C}

  /* ── Timeline ── */
  .tl-group-header{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#F9F8F8;border-radius:6px;margin-bottom:6px;cursor:pointer;user-select:none;border:1px solid rgba(0,0,0,0.07)}
  .tl-group-label{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;display:flex;align-items:center;gap:6px}
  .tl-group-pre{color:#C2410C}
  .tl-group-rfx{color:#D97706}
  .tl-group-post{color:#6B7280}
  .tl-act-row{display:grid;gap:6px;align-items:center;margin-bottom:5px;padding:7px 10px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:6px;transition:border-color .15s}
  .tl-act-row:hover{border-color:rgba(194,65,12,0.3)}
  .tl-act-row.is-child{margin-left:22px;background:#F9F8F8;border-left:2px solid rgba(217,119,6,0.4)}
  .tl-act-row.is-parent{border-left:2px solid rgba(194,65,12,0.4)}
  .tl-act-row.dragging{opacity:.5}
  .tl-act-row.drag-over{border-color:#C2410C;border-style:dashed}
  .tl-cell-input{border:1px solid rgba(0,0,0,0.1);border-radius:4px;padding:5px 7px;font-family:'Lora',serif;font-size:12px;color:#111827;background:#FFFFFF;outline:none;width:100%}
  .tl-cell-input:focus{border-color:#C2410C}
  .tl-col-hdr{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9CA3AF}

  /* ── Gantt ── */
  .gantt-wrap{overflow-x:auto;margin-top:20px}
  .gantt-container{min-width:640px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:18px}
  .gantt-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#9CA3AF;margin-bottom:14px}

  /* ── Market research ── */
  .vendor-card{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:8px;padding:16px 18px;margin-bottom:10px;transition:border-color .15s}
  .vendor-card:hover{border-color:rgba(194,65,12,0.25)}
  .vendor-card.shortlisted{border-color:rgba(194,65,12,0.4);background:#FFF7ED}
  .vendor-card.eliminated{opacity:.45;border-color:rgba(220,38,38,0.2)}
  .vendor-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#111827;margin-bottom:2px}
  .vendor-category{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:8px}
  .vendor-meta{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}
  .vendor-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
  .vendor-badge{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:3px;white-space:nowrap}
  .vb-saas{background:#F0FDF4;color:#166534;border:1px solid #BBF7D0}
  .vb-onprem{background:#FFFBEB;color:#D97706;border:1px solid #FCD34D}
  .vb-hybrid{background:#EFF6FF;color:#1E40AF;border:1px solid #BFDBFE}
  .vb-low{background:#F0FDF4;color:#166534;border:1px solid #BBF7D0}
  .vb-medium{background:#FFFBEB;color:#D97706;border:1px solid #FCD34D}
  .vb-high{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA}
  .vb-startup{background:#F0FDF4;color:#166534;border:1px solid #BBF7D0}
  .vb-growth{background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74}
  .vb-established{background:#F3F4F6;color:#374151;border:1px solid #D1D5DB}
  .vb-legacy{background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB}
  .vb-neutral{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}
  .vendor-rating{font-family:'JetBrains Mono',monospace;font-size:11px;color:#D97706;display:flex;align-items:center;gap:4px}
  .vendor-reviews{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9CA3AF}
  .vendor-desc{font-size:12px;color:#6B7280;line-height:1.5;margin-bottom:10px}
  .vendor-match{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .vendor-match-bar{flex:1;height:4px;background:rgba(0,0,0,0.06);border-radius:2px;overflow:hidden;max-width:120px}
  .vendor-match-fill{height:100%;border-radius:2px;background:#C2410C}
  .vendor-match-fill.medium{background:#D97706}
  .vendor-match-fill.low{background:#D1D5DB}
  .vendor-match-text{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9CA3AF}
  .vendor-actions{display:flex;gap:6px}
  .vendor-btn{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:3px;cursor:pointer;border:1px solid;transition:all .15s}
  .vendor-btn-shortlist{color:#C2410C;border-color:rgba(194,65,12,0.3);background:transparent}
  .vendor-btn-shortlist:hover,.vendor-btn-shortlist.active{background:#FFF7ED;border-color:#C2410C}
  .vendor-btn-eliminate{color:#DC2626;border-color:rgba(220,38,38,0.3);background:transparent}
  .vendor-btn-eliminate:hover,.vendor-btn-eliminate.active{background:#FEF2F2;border-color:#DC2626}
  .vendor-btn-g2{color:#9CA3AF;border-color:rgba(0,0,0,0.1);background:transparent}
  .vendor-btn-g2:hover{color:#374151;border-color:rgba(0,0,0,0.2)}
  .confidence-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}
  .confidence-high{background:#C2410C}
  .confidence-medium{background:#D97706}
  .confidence-low{background:#D1D5DB}

  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{animation:spin .8s linear infinite;display:inline-block}
  .rq-fade{animation:fadeUp .3s ease both}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

  /* ── Skeleton loader ── */
  .rq-skeleton{background:linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:6px}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

  /* ── Mobile hamburger ── */
  .rq-hamburger{display:none;background:none;border:none;cursor:pointer;padding:6px;color:#374151}
  .rq-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:40}

  /* ── Mobile breakpoint ── */
  @media(max-width:768px){
    .rq-hamburger{display:flex;align-items:center;justify-content:center}
    .rq-shell{position:relative}
    .rq-sidebar{position:fixed;top:0;left:0;height:100vh;z-index:50;transform:translateX(-100%)}
    .rq-sidebar.open{transform:translateX(0)}
    .rq-sidebar-overlay.open{display:block}
    .rq-topbar{padding:10px 16px}
    .rq-content{padding:18px 16px}
    .rq-metrics{grid-template-columns:1fr 1fr}
    .rq-topbar-sub{display:none}
    .rq-export-btn span{display:none}
    .rq-export-btn{padding:8px 10px}
    .tl-col-hdr:nth-child(4),.tl-act-row>*:nth-child(4){display:none}
    .gantt-wrap{margin-left:-16px;margin-right:-16px}
  }
  @media(max-width:480px){
    .rq-metrics{grid-template-columns:1fr 1fr}
    .rq-actions{flex-wrap:wrap}
    .rq-btn-primary,.rq-btn-ghost{font-size:10px;padding:8px 12px}
  }
`;
document.head.appendChild(_style);

// ─── Utils ────────────────────────────────────────────────────────────────────
const genId = () => "SES-" + Math.random().toString(36).substring(2, 9).toUpperCase();
const uid = () => "a" + Date.now() + Math.random().toString(36).substring(2, 5);

async function callClaude(system, user, useWebSearch = false, model = null, identity = {}) {
  const body = { system, user, useWebSearch };
  if (model) body.model = model;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(identity.userId   && { "X-User-Id":    identity.userId }),
        ...(identity.tenantId && { "X-Tenant-Id":  identity.tenantId }),
        ...(identity.sessionId && { "X-Session-Id": identity.sessionId }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const d = await res.json();
    if (!res.ok || d.error) throw new Error(`API ${res.status}: ${d.error?.type || ""} — ${d.error?.message || JSON.stringify(d)}`);
    return d.content?.filter(b => b.type === "text").map(b => b.text).join("") ?? "";
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error("Request timed out — please try again.");
    throw e;
  }
}

async function callJSON(system, user, useWebSearch = false, model = null, identity = {}) {
  const t = await callClaude(system, user, useWebSearch, model, identity);
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : t;
  const arrMatch = candidate.match(/\[[\s\S]*\]/);
  const objMatch = candidate.match(/\{[\s\S]*\}/);
  const jsonStr = (arrMatch ? arrMatch[0] : objMatch ? objMatch[0] : candidate).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`JSON parse failed. Raw response: ${t.slice(0, 300)}`);
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function addCalDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function calDaysBetween(startStr, endStr) {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  return Math.round((e - s) / 86400000);
}

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function today() { return new Date().toISOString().split("T")[0]; }

// ─── Default activities ───────────────────────────────────────────────────────
// offsetDays: n+ days after startDate for endDate default
// parentId: sub-activity of another
// group: Pre-RFx | RFx | Post-RFx
function makeDefaultActivities(startDate) {
  const t = startDate || today();

  // Helper: date string from a reference + offset
  const d = (base, offset) => addCalDays(base, offset);

  const scopeStart = t;
  const scopeEnd = d(t, 7);           // +1 week
  const marketEnd = d(t, 14);         // +2 weeks from scope start
  const vendorEnd = d(marketEnd, 7);  // +1 week from market end
  const finScopeEnd = d(vendorEnd, 7);
  const evalTeamEnd = d(vendorEnd, 14);
  const issueStart = d(evalTeamEnd, 3);
  const issueEnd = d(issueStart, 14);
  const vendorQEnd = d(issueStart, 4 + 2); // n+4 days start, +2 days duration
  const respondEnd = d(vendorQEnd, 3);
  const submitStart = d(respondEnd, 2);
  const submitEnd = d(submitStart, 7);
  const evalStart = d(respondEnd, 3);
  const evalRespEnd = d(evalStart, 8);
  const shortlistEnd = d(d(evalRespEnd, 1), 5);
  const techStart = d(d(shortlistEnd, 0), 28);
  const techEnd = d(techStart, 28);
  const evalTechEnd = d(techStart, 5);
  const alignStart = d(evalTechEnd, 10);
  const alignEnd = d(alignStart, 5);
  const finalStart = d(alignEnd, 10);
  const finalEnd = d(finalStart, 5);
  const negoStart = d(finalEnd, 1);
  const negoEnd = d(negoStart, 45);
  const implStart = d(negoEnd, 10);
  const implEnd = d(implStart, 45);

  return [
    // ── Pre-RFx ──
    { id: "a1",  group: "Pre-RFx",  parentId: null, name: "Draft Scope & Requirements",           startDate: scopeStart,  endDate: scopeEnd,     offsetDays: 7,  startOffsetDays: 0 },
    { id: "a2",  group: "Pre-RFx",  parentId: null, name: "Execute NDA",                           startDate: scopeStart,  endDate: issueStart,   offsetDays: calDaysBetween(scopeStart, issueStart), startOffsetDays: 0 },
    { id: "a3",  group: "Pre-RFx",  parentId: null, name: "Market Analysis",                       startDate: scopeStart,  endDate: marketEnd,    offsetDays: 14, startOffsetDays: 0 },
    { id: "a4",  group: "Pre-RFx",  parentId: null, name: "Vendor Identification",                 startDate: scopeStart,  endDate: vendorEnd,    offsetDays: calDaysBetween(scopeStart, vendorEnd), startOffsetDays: 0 },
    { id: "a5",  group: "Pre-RFx",  parentId: null, name: "Draft RFx",                             startDate: vendorEnd,   endDate: issueStart,   offsetDays: calDaysBetween(vendorEnd, issueStart), startOffsetDays: calDaysBetween(t, vendorEnd) },
    { id: "a5a", group: "Pre-RFx",  parentId: "a5", name: "Finalize Scope & Requirements",         startDate: vendorEnd,   endDate: finScopeEnd,  offsetDays: 7,  startOffsetDays: calDaysBetween(t, vendorEnd) },
    { id: "a5b", group: "Pre-RFx",  parentId: "a5", name: "Establish Evaluation Team, Criteria & Weighting", startDate: vendorEnd, endDate: evalTeamEnd, offsetDays: 14, startOffsetDays: calDaysBetween(t, vendorEnd) },
    // ── RFx ──
    { id: "a6",  group: "RFx",      parentId: null, name: "Issue RFx",                             startDate: issueStart,  endDate: issueEnd,     offsetDays: 14, startOffsetDays: calDaysBetween(t, issueStart) },
    { id: "a6a", group: "RFx",      parentId: "a6", name: "Vendors Submit Clarifying Questions",   startDate: d(issueStart, 4), endDate: vendorQEnd, offsetDays: 2, startOffsetDays: calDaysBetween(t, d(issueStart, 4)) },
    { id: "a6b", group: "RFx",      parentId: "a6", name: "Respond to Vendor Questions",           startDate: vendorQEnd,  endDate: respondEnd,   offsetDays: 3,  startOffsetDays: calDaysBetween(t, vendorQEnd) },
    { id: "a6c", group: "RFx",      parentId: "a6", name: "Submit RFx Response",                   startDate: submitStart, endDate: submitEnd,    offsetDays: 7,  startOffsetDays: calDaysBetween(t, submitStart) },
    { id: "a7",  group: "RFx",      parentId: null, name: "Evaluate RFx",                          startDate: evalStart,   endDate: evalTechEnd,  offsetDays: calDaysBetween(evalStart, evalTechEnd), startOffsetDays: calDaysBetween(t, evalStart) },
    { id: "a7a", group: "RFx",      parentId: "a7", name: "Evaluate Responses",                    startDate: evalStart,   endDate: evalRespEnd,  offsetDays: 8,  startOffsetDays: calDaysBetween(t, evalStart) },
    { id: "a7b", group: "RFx",      parentId: "a7", name: "Shortlist (Recommendation to Leadership)", startDate: d(evalRespEnd, 1), endDate: shortlistEnd, offsetDays: 5, startOffsetDays: calDaysBetween(t, d(evalRespEnd, 1)) },
    { id: "a7c", group: "RFx",      parentId: "a7", name: "Technical Evaluation (Demo / POC)",     startDate: techStart,   endDate: techEnd,      offsetDays: 28, startOffsetDays: calDaysBetween(t, techStart) },
    { id: "a7d", group: "RFx",      parentId: "a7", name: "Evaluate Technical Evaluation",         startDate: techStart,   endDate: evalTechEnd,  offsetDays: 5,  startOffsetDays: calDaysBetween(t, techStart) },
    // ── Post-RFx ──
    { id: "a8",  group: "Post-RFx", parentId: null, name: "Internal Alignment & Confirm Budget",   startDate: alignStart,  endDate: alignEnd,     offsetDays: 5,  startOffsetDays: calDaysBetween(t, alignStart) },
    { id: "a9",  group: "Post-RFx", parentId: null, name: "Final Recommendation",                  startDate: finalStart,  endDate: finalEnd,     offsetDays: 5,  startOffsetDays: calDaysBetween(t, finalStart) },
    { id: "a10", group: "Post-RFx", parentId: null, name: "Due Diligence",                         startDate: vendorEnd,   endDate: negoEnd,      offsetDays: calDaysBetween(vendorEnd, negoEnd), startOffsetDays: calDaysBetween(t, vendorEnd) },
    { id: "a11", group: "Post-RFx", parentId: null, name: "Negotiate Contract",                    startDate: negoStart,   endDate: negoEnd,      offsetDays: 45, startOffsetDays: calDaysBetween(t, negoStart) },
    { id: "a12", group: "Post-RFx", parentId: null, name: "Implementation",                        startDate: implStart,   endDate: implEnd,      offsetDays: 45, startOffsetDays: calDaysBetween(t, implStart) },
  ];
}

const GROUPS = ["Pre-RFx", "RFx", "Post-RFx"];
const GROUP_COLORS = { "Pre-RFx": "#2e5984", "RFx": "#3a6a52", "Post-RFx": "#a05828" };

// ─── Sole source activities ────────────────────────────────────────────────────
function makeSoleSourceActivities(startDate) {
  const t = startDate || today();
  const d = (base, offset) => addCalDays(base, offset);

  const scopeEnd   = d(t, 7);
  const memoStart  = d(t, 7);
  const memoEnd    = d(memoStart, 7);
  const demoStart  = d(memoEnd, 5);
  const demoEnd    = d(demoStart, 14);
  const alignStart = d(demoEnd, 3);
  const alignEnd   = d(alignStart, 5);
  const finalStart = d(alignEnd, 5);
  const finalEnd   = d(finalStart, 5);
  const negoStart  = d(finalEnd, 1);
  const negoEnd    = d(negoStart, 30);
  const implStart  = d(negoEnd, 7);
  const implEnd    = d(implStart, 45);

  // All activities in a single flat group — no Pre-RFx/RFx/Post-RFx headings
  return [
    { id: "s1", group: "Activities", parentId: null, name: "Draft Scope & Requirements",          startDate: t,          endDate: scopeEnd,   offsetDays: 7,  startOffsetDays: 0 },
    { id: "s2", group: "Activities", parentId: null, name: "Draft Sole Source Justification",     startDate: memoStart,  endDate: memoEnd,    offsetDays: 7,  startOffsetDays: calDaysBetween(t, memoStart) },
    { id: "s3", group: "Activities", parentId: null, name: "Technical Evaluation (Demo / POC)",   startDate: demoStart,  endDate: demoEnd,    offsetDays: 14, startOffsetDays: calDaysBetween(t, demoStart) },
    { id: "s4", group: "Activities", parentId: null, name: "Due Diligence",                       startDate: demoEnd,    endDate: negoEnd,    offsetDays: calDaysBetween(demoEnd, negoEnd), startOffsetDays: calDaysBetween(t, demoEnd) },
    { id: "s5", group: "Activities", parentId: null, name: "Internal Alignment & Confirm Budget", startDate: alignStart, endDate: alignEnd,   offsetDays: 5,  startOffsetDays: calDaysBetween(t, alignStart) },
    { id: "s6", group: "Activities", parentId: null, name: "Final Recommendation",                startDate: finalStart, endDate: finalEnd,   offsetDays: 5,  startOffsetDays: calDaysBetween(t, finalStart) },
    { id: "s7", group: "Activities", parentId: null, name: "Negotiate Contract",                  startDate: negoStart,  endDate: negoEnd,    offsetDays: 30, startOffsetDays: calDaysBetween(t, negoStart) },
    { id: "s8", group: "Activities", parentId: null, name: "Implementation",                      startDate: implStart,  endDate: implEnd,    offsetDays: 45, startOffsetDays: calDaysBetween(t, implStart) },
  ];
}

// ─── Auto-suggest buying channel from scope bullets ───────────────────────────
function suggestChannel(scopeBullets, formalScope) {
  const text = [...(scopeBullets || []), formalScope || ""].join(" ").toLowerCase();
  const soleSourceSignals = [
    "sole source", "single vendor", "only vendor", "existing vendor", "incumbent",
    "proprietary", "no alternative", "only option", "continuation", "existing contract",
    "current provider", "specific vendor", "named vendor", "sole supplier",
  ];
  const hits = soleSourceSignals.filter(s => text.includes(s));
  return hits.length >= 1 ? "sole-source" : "competitive-bid";
}

// ─── Gantt ────────────────────────────────────────────────────────────────────
function GanttChart({ activities }) {
  const allDates = activities.flatMap(a => [a.startDate, a.endDate]).filter(Boolean).sort();
  if (!allDates.length) return (
    <div style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13, marginBottom: 24 }}>No dates set — configure your timeline first.</div>
  );
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const totalDays = Math.max(calDaysBetween(minDate, maxDate), 1);
  const BAR_H = 28;
  const GROUP_ROW_H = 26;

  // Derive groups dynamically from activities — supports both competitive bid and sole source
  const isSoleSource = activities.every(a => a.group === "Activities");
  const groups = isSoleSource ? ["Activities"] : GROUPS;
  const groupColors = { ...GROUP_COLORS, "Activities": "#5DCAA5" };
  const showGroupHeaders = !isSoleSource;

  const xPct = (dateStr) => {
    if (!dateStr) return 0;
    return Math.min(Math.max((calDaysBetween(minDate, dateStr) / totalDays) * 100, 0), 100);
  };
  const wPct = (s, e) => {
    if (!s || !e) return 0.5;
    return Math.max(Math.min((calDaysBetween(s, e) / totalDays) * 100, 100), 0.8);
  };

  // Month markers
  const markers = [];
  const mStart = new Date(minDate + "T00:00:00");
  const mEnd = new Date(maxDate + "T00:00:00");
  let md = new Date(mStart.getFullYear(), mStart.getMonth(), 1);
  while (md <= mEnd) {
    const ds = md.toISOString().split("T")[0];
    markers.push({ ds, pct: xPct(ds), label: md.toLocaleDateString("en-US", { month: "short", year: "numeric" }) });
    md = new Date(md.getFullYear(), md.getMonth() + 1, 1);
  }

  const totalWeeks = Math.round(totalDays / 7);

  return (
    <div style={{ overflowX: "auto", marginBottom: 24 }}>
      <div style={{ minWidth: 700, background: "#F9F8F8", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "20px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#C2410C" }}>Buying Timeline</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#6B7280" }}>
            {new Date(minDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            <span style={{ margin: "0 8px", color: "#9CA3AF" }}>→</span>
            {new Date(maxDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            <span style={{ marginLeft: 12, color: "#D97706" }}>{totalWeeks} weeks</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 0 }}>
          {/* Label column */}
          <div style={{ width: 240, flexShrink: 0, paddingRight: 16 }}>
            <div style={{ height: 32, marginBottom: 2 }} />
            {groups.map(g => {
              const gas = activities.filter(a => a.group === g);
              if (!gas.length) return null;
              return (
                <div key={g}>
                  {showGroupHeaders && (
                    <div style={{ height: GROUP_ROW_H, display: "flex", alignItems: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: groupColors[g], marginRight: 7, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: groupColors[g] }}>{g}</span>
                    </div>
                  )}
                  {gas.map(a => (
                    <div key={a.id} style={{ height: BAR_H + 6, display: "flex", alignItems: "center", paddingLeft: a.parentId ? 18 : 2 }}>
                      <span style={{
                        fontFamily: a.parentId ? "'Lora',serif" : "'Syne',sans-serif",
                        fontSize: a.parentId ? 11 : 12,
                        fontWeight: a.parentId ? 400 : 600,
                        fontStyle: a.parentId ? "italic" : "normal",
                        color: a.parentId ? "#6B7280" : "#374151",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        lineHeight: 1.3,
                      }}>{a.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Chart area */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", borderLeft: "1px solid rgba(0,0,0,0.07)" }}>
            {/* Month header */}
            <div style={{ height: 32, position: "relative", marginBottom: 2, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
              {markers.map(m => (
                <div key={m.ds} style={{ position: "absolute", left: `${m.pct}%`, top: 0, height: "100%", display: "flex", alignItems: "center", paddingLeft: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#6B7280", whiteSpace: "nowrap" }}>{m.label}</span>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.06)" }} />
                </div>
              ))}
            </div>

            {groups.map(g => {
              const gas = activities.filter(a => a.group === g);
              if (!gas.length) return null;
              const color = groupColors[g];
              return (
                <div key={g}>
                  {/* Group span bar — only shown for competitive bid */}
                  {showGroupHeaders && (
                    <div style={{ height: GROUP_ROW_H, position: "relative", display: "flex", alignItems: "center" }}>
                      {(() => {
                        const gDates = gas.flatMap(a => [a.startDate, a.endDate]).filter(Boolean).sort();
                        if (gDates.length < 2) return null;
                        return <div style={{ position: "absolute", left: `${xPct(gDates[0])}%`, width: `${wPct(gDates[0], gDates[gDates.length - 1])}%`, height: 4, background: color, opacity: 0.2, borderRadius: 2 }} />;
                      })()}
                    </div>
                  )}
                  {gas.map(a => {
                    const isChild = !!a.parentId;
                    const hasBar = a.startDate && a.endDate;
                    return (
                      <div key={a.id} style={{ height: BAR_H + 6, position: "relative", display: "flex", alignItems: "center" }}>
                        {/* Grid lines */}
                        {markers.map(m => (
                          <div key={m.ds} style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.04)" }} />
                        ))}
                        {hasBar && (
                          <div style={{
                            position: "absolute",
                            left: `${xPct(a.startDate)}%`,
                            width: `${wPct(a.startDate, a.endDate)}%`,
                            height: isChild ? BAR_H * 0.6 : BAR_H,
                            background: isChild ? "transparent" : color,
                            border: isChild ? `2px solid ${color}` : "none",
                            opacity: isChild ? 0.75 : 0.9,
                            borderRadius: 4,
                            display: "flex", alignItems: "center", paddingLeft: 7, overflow: "hidden",
                          }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: isChild ? color : "rgba(0,0,0,0.75)", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {calDaysBetween(a.startDate, a.endDate)}d
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 20, flexWrap: "wrap" }}>
          {showGroupHeaders && groups.map(g => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 10, background: groupColors[g], borderRadius: 3, opacity: 0.9 }} />
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, color: "#6B7280" }}>{g}</span>
            </div>
          ))}
          {showGroupHeaders && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 10, border: "2px solid #9CA3AF", borderRadius: 3 }} />
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, color: "#6B7280" }}>Sub-activity</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// ─── DocX Export ──────────────────────────────────────────────────────────────
async function buildDocx({ sessionId, projectTitle, formalScope, narrative, requirements, questions, activities, rfpStart, goLive, vendors, vendorStatus, userProfile }) {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "D4CCC4" };
  const borders = { top: b, bottom: b, left: b, right: b };
  const cm = { top: 90, bottom: 90, left: 130, right: 130 };

  const hCell = (text, w) => new TableCell({ borders, margins: cm, width: { size: w, type: WidthType.DXA }, shading: { fill: "2E2925", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "F7F5F2", font: "Arial", size: 20 })] })] });
  const bCell = (text, w, shade) => new TableCell({ borders, margins: cm, width: { size: w, type: WidthType.DXA }, shading: { fill: shade ? "FAF9F7" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: String(text || "—"), font: "Arial", size: 20 })] })] });

  const numberingConfig = [{ reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 360 } } } }] }];
  let alphaCounter = 0;

  const qChildren = [];
  for (const req of requirements) {
    const qs = questions[req.id] || [];
    if (!qs.length) continue;
    qChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${req.id}: ${req.text}`, font: "Arial" })] }));
    qs.forEach(q => {
      qChildren.push(new Paragraph({ numbering: { reference: "nums", level: 0 }, children: [new TextRun({ text: q.text, font: "Arial", size: 22 })] }));
      if (q.type === "multiple_choice" && q.options?.length) {
        const ref = `alpha-${alphaCounter++}`;
        numberingConfig.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.LOWER_LETTER, text: "%1)", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });
        q.options.forEach(opt => qChildren.push(new Paragraph({ numbering: { reference: ref, level: 0 }, children: [new TextRun({ text: opt, font: "Arial", size: 20, color: "5A5048" })] })));
      } else {
        qChildren.push(new Paragraph({ children: [new TextRun({ text: "[Open response]", font: "Arial", size: 20, italics: true, color: "9A8E82" })] }));
      }
      qChildren.push(new Paragraph({ children: [new TextRun("")] }));
    });
  }

  const tlRows = [new TableRow({ children: [hCell("Activity", 3400), hCell("Start", 1900), hCell("End", 1900), hCell("Duration (days)", 2160)] })];
  let rowIdx = 0;
  for (const g of GROUPS) {
    const gas = activities.filter(a => a.group === g);
    if (!gas.length) continue;
    tlRows.push(new TableRow({ children: [new TableCell({ borders, margins: cm, columnSpan: 4, width: { size: 9360, type: WidthType.DXA }, shading: { fill: "F0EDE8", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: g, bold: true, font: "Arial", size: 20, color: "6B5F52" })] })] })] }));
    gas.forEach(a => {
      const shade = rowIdx++ % 2 === 1;
      const dur = a.startDate && a.endDate ? String(calDaysBetween(a.startDate, a.endDate)) : "—";
      tlRows.push(new TableRow({ children: [bCell((a.parentId ? "    ↳ " : "") + a.name, 3400, shade), bCell(fmtDate(a.startDate), 1900, shade), bCell(fmtDate(a.endDate), 1900, shade), bCell(dur, 2160, shade)] }));
    });
  }

  // Narrative paragraphs — split on newlines for proper paragraph breaks
  const narrativeText = narrative || formalScope || "";
  const narrativeParas = narrativeText.split(/\n+/).filter(Boolean).map(para =>
    new Paragraph({ children: [new TextRun({ text: para, font: "Arial", size: 24 })], spacing: { line: 360, after: 160 } })
  );

  const doc = new Document({
    numbering: { config: numberingConfig },
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, font: "Arial", color: "1A1714" }, paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: "3A3028" }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
      ]
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: projectTitle || "Requirements Document", bold: true, size: 56, font: "Arial", color: "1A1714" })] }),
        new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, font: "Arial", size: 18, color: "9A8E82" })] }),
        ...(userProfile ? [new Paragraph({ children: [new TextRun({ text: `Prepared by: ${[userProfile.name, userProfile.title, userProfile.department, userProfile.tenant_config?.brand_name || userProfile.tenant_config?.company_name].filter(Boolean).join(", ")}`, font: "Arial", size: 18, color: "9A8E82" })] })] : []),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "1. Business Case", font: "Arial" })] }),
        ...narrativeParas,
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "2. Functional Requirements", font: "Arial" })] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA }, columnWidths: [1440, 7920],
          rows: [
            new TableRow({ children: [hCell("ID", 1440), hCell("Requirement", 7920)] }),
            ...requirements.map((r, i) => new TableRow({ children: [
              new TableCell({ borders, margins: cm, width: { size: 1440, type: WidthType.DXA }, shading: { fill: i % 2 ? "FAF9F7" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: r.id, font: "Arial Narrow", size: 20 })] })] }),
              bCell(r.text, 7920, i % 2)
            ]}))
          ]
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "3. Questions", font: "Arial" })] }),
        ...qChildren,
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "4. Buying Timeline", font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: `Start: ${fmtDate(rfpStart)}   |   Go-Live: ${fmtDate(goLive)}${rfpStart && goLive ? `   |   ${calDaysBetween(rfpStart, goLive)} calendar days` : ""}`, font: "Arial", size: 20, color: "6A6058" })] }),
        new Paragraph({ children: [new TextRun("")] }),
        new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3400, 1900, 1900, 2160], rows: tlRows }),
        new Paragraph({ children: [new TextRun("")] }),
        ...(vendors && vendors.length > 0 ? [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "5. Vendor Shortlist", font: "Arial" })] }),
          new Paragraph({ children: [new TextRun({ text: "Pricing estimates are agent-generated. Verify with vendors before use in budget planning.", font: "Arial", size: 18, italics: true, color: "9A8E82" })] }),
          new Paragraph({ children: [new TextRun("")] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [1800, 1200, 1400, 900, 1060, 3000],
            rows: [
              new TableRow({ children: [hCell("Vendor", 1800), hCell("Category", 1200), hCell("Est. Price (Yr 1)", 1400), hCell("Confidence", 900), hCell("Req. Match", 1060), hCell("Description", 3000)] }),
              ...vendors
                .filter(v => !vendorStatus || vendorStatus[v.name] !== "eliminated")
                .map((v, i) => new TableRow({ children: [
                  bCell(v.name + (vendorStatus && vendorStatus[v.name] === "shortlisted" ? " ✓" : ""), 1800, i % 2),
                  bCell(v.category, 1200, i % 2),
                  bCell(v.estimatedPrice || "Contact vendor", 1400, i % 2),
                  bCell(v.priceConfidence ? `${v.priceConfidence} conf.` : "—", 900, i % 2),
                  bCell(`${v.requirementsMatch}/${v.requirementsTotal}`, 1060, i % 2),
                  bCell(v.description, 3000, i % 2),
                ]}))
            ]
          })
        ] : []),
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${projectTitle ? projectTitle.replace(/[^a-zA-Z0-9_-]/g, "_") : "Pario"}.docx`);
}

// ─── Component ────────────────────────────────────────────────────────────────
// ─── Profile Setup Screen (first login) ──────────────────────
function ProfileSetupScreen({ onComplete }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    if (!name.trim()) { setErr("Please enter your name."); return; }
    setBusy(true); setErr("");
    const ok = await saveUserProfile({ name: name.trim(), title: title.trim(), role: "buyer" });
    if (ok) {
      onComplete({ name: name.trim(), title: title.trim() });
    } else {
      setErr("Could not save profile — please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="rq-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#C2410C", marginBottom: 8 }}>One quick thing</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Tell us who you are</div>
        <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#6B7280", marginBottom: 28 }}>This appears on your exported documents.</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Your name</div>
          <input className="rq-input" placeholder="e.g. Jane Smith" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} autoFocus />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Your title <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
          <input className="rq-input" placeholder="e.g. VP Operations" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        </div>
        {err && <div className="rq-error" style={{ marginBottom: 14 }}>{err}</div>}
        <button className="rq-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={handle} disabled={busy}>
          {busy ? <><Loader size={13} className="spin" /> Saving…</> : <>Let's go <ChevronRight size={13} /></>}
        </button>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────
function LoginScreen({ onUnconfirmed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const handle = async () => {
    if (!email.trim() || !password.trim()) { setErr("Email and password are required."); return; }
    setBusy(true); setErr(""); setMsg("");
    const fn = mode === "signup" ? signUp : signIn;
    const { data, error } = await fn(email, password);
    if (error) {
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        onUnconfirmed?.();
      } else {
        setErr(error.message);
      }
      setBusy(false);
      return;
    }
    if (mode === "signup") {
      onUnconfirmed?.();
    }
    setBusy(false);
  };

  return (
    <div className="rq-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#C2410C", marginBottom: 8 }}>Pario</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </div>
        <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#6B7280", marginBottom: 28 }}>
          {mode === "signup" ? "Start building better business cases." : "Sign in to continue."}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Email</div>
          <input className="rq-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Password</div>
          <input className="rq-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        </div>
        {err && <div className="rq-error" style={{ marginBottom: 14 }}>{err}</div>}
        {msg && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 14 }}>{msg}</div>}
        <button className="rq-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={handle} disabled={busy}>
          {busy ? <><Loader size={13} className="spin" /> {mode === "signup" ? "Creating account…" : "Signing in…"}</> : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#6B7280" }}>
          {mode === "signin" ? <>No account? <button style={{ background: "none", border: "none", color: "#C2410C", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }} onClick={() => { setMode("signup"); setErr(""); setMsg(""); }}>Create one</button></> : <>Have an account? <button style={{ background: "none", border: "none", color: "#C2410C", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }} onClick={() => { setMode("signin"); setErr(""); setMsg(""); }}>Sign in</button></>}
        </div>
      </div>
    </div>
  );
}

export default function RequirementsAgent() {
  const [sessionId, setSessionId] = useState(genId);
  const [step, setStep] = useState(0);
  const [projectTitle, setProjectTitle] = useState("");
  const [view, setView] = useState("splash");
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSaved, setLastSaved] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileEditName, setProfileEditName] = useState("");
  const [profileEditTitle, setProfileEditTitle] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [tenantBrandName, setTenantBrandName] = useState("");
  const tenantProfileRef = useRef(null); // persists across session resets
  const isDirty = useRef(false);

  // Scope
  const [answers, setAnswers] = useState({ who: "", what: "", where: "", when: "", why: "", freeform: "", companyName: "", companyProfile: null });
  const [companyLookupBusy, setCompanyLookupBusy] = useState(false);
  const [companyLookupErr, setCompanyLookupErr] = useState("");
  const [narrative, setNarrative] = useState("");
  const [narrativeBusy, setNarrativeBusy] = useState(false);
  const [formalScope, setFormalScope] = useState("");
  const [prevScope, setPrevScope] = useState(null); // versioning
  const [execSummary, setExecSummary] = useState("");
  const [scopeBullets, setScopeBullets] = useState([]);
  const [bulletsApproved, setBulletsApproved] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // [{role, content}]
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [bulletsCollapsed, setBulletsCollapsed] = useState(false);
  const [continuingChat, setContinuingChat] = useState(false);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [scopeFlags, setScopeFlags] = useState([]);
  const [flagResponses, setFlagResponses] = useState({});
  const [scopeApproved, setScopeApproved] = useState(false);
  const [scopeBusy, setScopeBusy] = useState(false);
  const [scopeErr, setScopeErr] = useState("");
  const [editingScope, setEditingScope] = useState(false);
  const [expertQuestions, setExpertQuestions] = useState([]);
  const [expertResponses, setExpertResponses] = useState({});
  const [expertApproved, setExpertApproved] = useState(false);

  // Requirements
  const [requirements, setRequirements] = useState([]);
  const [prevRequirements, setPrevRequirements] = useState(null); // versioning
  const [scopeFeedback, setScopeFeedback] = useState(null); // 'up' | 'down' | null
  const [reqsFeedback, setReqsFeedback] = useState(null);
  const [vendorsFeedback, setVendorsFeedback] = useState(null);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [reqsBusy, setReqsBusy] = useState(false);
  const [reqsErr, setReqsErr] = useState("");
  const [newReq, setNewReq] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  // Questions
  const [questions, setQuestions] = useState({});
  const [qBusy, setQBusy] = useState(false);
  const [qErr, setQErr] = useState("");

  // Timeline
  const [rfpStart, setRfpStart] = useState(today);
  const [goLive, setGoLive] = useState(() => addCalDays(today(), 180));
  const [activities, setActivities] = useState(() => makeDefaultActivities(today()));
  const [buyingChannel, setBuyingChannel] = useState(null); // null | "competitive-bid" | "sole-source"
  const [channelSuggested, setChannelSuggested] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({ "Pre-RFx": false, "RFx": false, "Post-RFx": false });
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [newActName, setNewActName] = useState("");
  const [newActGroup, setNewActGroup] = useState("Pre-RFx");

  // Export
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState("");

  // Market research
  const [vendors, setVendors] = useState([]);
  const [vendorStatus, setVendorStatus] = useState({}); // { vendorName: 'shortlisted' | 'eliminated' }
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketErr, setMarketErr] = useState("");

  const allAnswered = (answers.freeform || "").trim().length > 20 || FIVE_WS.every(w => answers[w.key].trim().length > 0);
  const isSkipped = (val) => val.trim().toLowerCase() === "skip";
  const allFlagResponsesFilled = scopeFlags.every((_, idx) => (flagResponses[idx] || "").trim().length > 0);

  // Unsaved changes warning on close/navigate away
  useEffect(() => {
    const handler = (e) => {
      if (isDirty.current && formalScope) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formalScope]);

  useEffect(() => { isDirty.current = true; }, [projectTitle, answers, formalScope, requirements, questions, activities]);

  // Auth + tenant config loading
  useEffect(() => {
    getSession().then(session => {
      const user = session?.user || null;
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        // Load sessions only after we know who the user is
        setSessionsLoading(true);
        loadSessions(user.id).then(rows => { setSessionsList(rows); setSessionsLoading(false); });
        loadUserProfile().then(profile => {
          setUserProfile(profile);
          if (profile?.tenant_config) {
            const tc = profile.tenant_config;
            setTenantBrandName(tc.brand_name || tc.company_name || "");
            const companyProfile = {
              name: tc.company_name,
              brandName: tc.brand_name || tc.company_name,
              vertical: tc.vertical,
              subVertical: tc.sub_vertical,
              employeeCount: tc.employee_count,
              hq: tc.hq,
              publicPrivate: tc.public_private,
              ticker: tc.ticker,
              description: tc.description,
              knownTechStack: tc.tech_stack || [],
              regulatoryContext: tc.regulatory_context,
            };
            tenantProfileRef.current = companyProfile; // persist across resets
            setAnswers(p => ({ ...p, companyProfile }));
          }
        });
      }
    });
    const unsub = onAuthStateChange((event, session) => {
      const user = session?.user || null;
      setAuthUser(user);
      if (user) {
        setSessionsLoading(true);
        loadSessions(user.id).then(rows => { setSessionsList(rows); setSessionsLoading(false); });
      } else {
        setUserProfile(null);
        setSessionsList([]);
        setAnswers(p => ({ ...p, companyProfile: null }));
      }
    });
    return unsub;
  }, []);

  const formalScopeRef = useRef(formalScope);
  useEffect(() => { formalScopeRef.current = formalScope; }, [formalScope]);

  const doSaveRef = useRef(null);
  useEffect(() => { doSaveRef.current = doSave; });

  useEffect(() => {
    const t = setInterval(() => {
      if (isDirty.current && formalScopeRef.current) doSaveRef.current?.("draft");
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const resetSession = () => {
    setSessionId(genId());
    setProjectTitle("");
    setAnswers(prev => ({ who: "", what: "", where: "", when: "", why: "", freeform: "", companyName: prev.companyName || "", companyProfile: tenantProfileRef.current || prev.companyProfile || null }));
    setCompanyLookupBusy(false);
    setCompanyLookupErr("");
    setNarrative("");
    setNarrativeBusy(false);
    setFormalScope("");
    setExecSummary("");
    setScopeBullets([]);
    setBulletsApproved(false);
    setChatMessages([]);
    setChatInput("");
    setChatCollapsed(false);
    setBulletsCollapsed(false);
    setContinuingChat(false);
    setInputCollapsed(false);
    setScopeFlags([]);
    setFlagResponses({});
    setScopeApproved(false);
    setScopeErr("");
    setEditingScope(false);
    setExpertQuestions([]);
    setExpertResponses({});
    setExpertApproved(false);
    setRequirements([]);
    setReqsErr("");
    setNewReq("");
    setEditId(null);
    setQuestions({});
    setQErr("");
    setVendors([]);
    setVendorStatus({});
    setMarketErr("");
    setActivities(makeDefaultActivities(today()));
    setBuyingChannel(null);
    setChannelSuggested(false);
    setRfpStart(today());
    setGoLive(addCalDays(today(), 180));
    setView("scope");
  };

  const getSessionData = () => ({ step, projectTitle, answers, formalScope, execSummary, scopeBullets, bulletsApproved, chatMessages, scopeApproved, requirements, questions, activities, rfpStart, goLive, buyingChannel, vendors, vendorStatus, narrative });

  const doSave = async (status = "draft") => {
    setSaveStatus("saving");
    const userId = authUser?.id || null;
    const tenantId = userProfile?.tenant_id || null;
    const ok = await saveSession({ id: sessionId, projectTitle: projectTitle || "Untitled", status, data: getSessionData(), userId, tenantId });
    if (ok) { setSaveStatus("saved"); setLastSaved(new Date()); isDirty.current = false; loadSessions(authUser?.id).then(setSessionsList); setTimeout(() => setSaveStatus("idle"), 2500); }
    else { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
  };

  const doLoadSession = async (id) => {
    setSessionLoading(true);
    const row = await loadSession(id, authUser?.id);
    setSessionLoading(false);
    if (!row?.data) return;
    const d = row.data;
    setSessionId(id);
    if (d.step !== undefined) setStep(d.step);
    if (d.projectTitle) setProjectTitle(d.projectTitle);
    if (d.answers) setAnswers(d.answers);
    if (d.formalScope) setFormalScope(d.formalScope);
    if (d.execSummary) setExecSummary(d.execSummary);
    if (d.scopeBullets) setScopeBullets(d.scopeBullets);
    if (d.bulletsApproved) setBulletsApproved(d.bulletsApproved);
    if (d.chatMessages) setChatMessages(d.chatMessages);
    if (d.scopeApproved) setScopeApproved(d.scopeApproved);
    setEditingScope(false);
    if (d.requirements) setRequirements(d.requirements);
    if (d.questions) setQuestions(d.questions);
    if (d.rfpStart) setRfpStart(d.rfpStart);
    if (d.goLive) setGoLive(d.goLive);
    if (d.buyingChannel) { setBuyingChannel(d.buyingChannel); setChannelSuggested(true); }
    // Only restore activities if they have the new group structure
    if (d.activities && d.activities.length > 0 && d.activities[0].group) {
      // Migrate old Pre-RFP/RFP/Post-RFP group names to Pre-RFx/RFx/Post-RFx
      const migrated = d.activities.map(a => ({
        ...a,
        group: a.group === "Pre-RFP" ? "Pre-RFx" : a.group === "RFP" ? "RFx" : a.group === "Post-RFP" ? "Post-RFx" : a.group
      }));
      setActivities(migrated);
    } else {
      setActivities(makeDefaultActivities(d.rfpStart || today()));
    }
    if (d.vendors) setVendors(d.vendors);
    if (d.vendorStatus) setVendorStatus(d.vendorStatus);
    if (d.narrative) setNarrative(d.narrative);
    setView("scope");
    setLastSaved(new Date(row.updated_at));
  };

  const doDeleteSession = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project?")) return;
    await deleteSession(id, authUser?.id);
    setSessionsList(p => p.filter(s => s.id !== id));
  };

  const doDeleteCurrentSession = async () => {
    if (!window.confirm(`Delete "${projectTitle || "this project"}"? This cannot be undone.`)) return;
    await deleteSession(sessionId, authUser?.id);
    setSessionsList(p => p.filter(s => s.id !== sessionId));
    resetSession();
    setView("sessions");
  };

  const doSelectChannel = (channel) => {
    setBuyingChannel(channel);
    setChannelSuggested(true);
    const newActivities = channel === "sole-source"
      ? makeSoleSourceActivities(rfpStart)
      : makeDefaultActivities(rfpStart);
    setActivities(newActivities);
    // Update go-live to last activity end date
    const lastDate = newActivities.map(a => a.endDate).filter(Boolean).sort().pop();
    if (lastDate) setGoLive(lastDate);
  };

  // Auto-suggest channel when requirements are first generated
  useEffect(() => {
    if (requirements.length > 0 && !channelSuggested && (scopeBullets.length > 0 || formalScope)) {
      const suggested = suggestChannel(scopeBullets, formalScope);
      setBuyingChannel(suggested);
      setChannelSuggested(true);
    }
  }, [requirements]);

  const handleRfpStartChange = (newStart) => {
    setRfpStart(newStart);
    // Recompute all dates from stored offsets relative to new start
    setActivities(prev => prev.map(a => ({
      ...a,
      startDate: addCalDays(newStart, a.startOffsetDays ?? 0),
      endDate: addCalDays(newStart, (a.startOffsetDays ?? 0) + (a.offsetDays ?? 7)),
    })));
  };

  const handleGoLiveChange = (newEnd) => {
    setGoLive(newEnd);
  };
  const doSendChatMessage = async (userText) => {
    if (!userText?.trim()) return;
    const newMessages = [...chatMessages, { role: "user", content: userText.trim() }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatBusy(true);
    try {
      // Build system prompt outside JSON.stringify to catch errors early
      const p = answers.companyProfile || tenantProfileRef.current;
      const companyCtx = p ? [
        p.name && `Company: ${p.name}`,
        p.vertical && `Industry: ${p.vertical}${p.subVertical ? ` — ${p.subVertical}` : ""}`,
        p.hq && `HQ: ${p.hq}`,
        p.publicPrivate && `Type: ${p.publicPrivate}${p.ticker ? ` (${p.ticker})` : ""}`,
        p.knownTechStack?.length && `Known tech stack: ${p.knownTechStack.join(", ")}`,
        p.regulatoryContext && `Regulatory obligations: ${p.regulatoryContext}`,
        p.description && `About: ${p.description}`,
      ].filter(Boolean).join("\n") : null;
      const systemPrompt = P_SCOPE_CHAT(companyCtx);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authUser?.id           && { "X-User-Id":    authUser.id }),
          ...(userProfile?.tenant_id  && { "X-Tenant-Id":  userProfile.tenant_id }),
          ...(sessionId              && { "X-Session-Id": sessionId }),
        },
        body: JSON.stringify({
          system: systemPrompt,
          user: newMessages.map(m => `${m.role === "user" ? "User" : "Pario"}: ${m.content}`).join("\n\n"),
          model: "claude-haiku-4-5-20251001",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();

      // Handle API errors
      if (!res.ok || data.error) {
        const detail = data.error?.message || `HTTP ${res.status}`;
        console.error("Pario chat API error:", detail, data);
        setChatMessages(prev => [...prev, { role: "assistant", content: "Something went wrong — please try again." }]);
        return;
      }

      // Extract text from content array
      const reply = (Array.isArray(data.content)
        ? data.content.filter(b => b.type === "text").map(b => b.text).join("")
        : (typeof data.content === "string" ? data.content : "")
      ).trim();

      if (!reply) {
        setChatMessages(prev => [...prev, { role: "assistant", content: "I didn't get a response — please try again." }]);
        return;
      }

      // DONE detection — catch DONE anywhere in the reply followed by a JSON array
      const doneMatch = reply.match(/DONE\s*\n?([\s\S]*?\[[\s\S]*?\])/);
      if (doneMatch) {
        const jsonPart = doneMatch[1].trim();
        const arrMatch = jsonPart.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try {
            const bullets = JSON.parse(arrMatch[0]);
            if (Array.isArray(bullets) && bullets.length > 0) {
              setScopeBullets(bullets);
              setChatCollapsed(true);
              setBulletsCollapsed(false);
              setContinuingChat(false);
              return;
            }
          } catch { /* fall through to render as message */ }
        }
      }

      // Strip all markdown formatting from conversational replies
      const clean = reply
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/^#+\s+/gm, "")
        .trim();

      // If the reply accidentally contains conversation history, extract only the last Pario line
      const lines = clean.split("\n").filter(Boolean);
      const lastPario = [...lines].reverse().find(l => !l.startsWith("User:") && !l.startsWith("Pario:"));
      const finalContent = lastPario
        ? lastPario.replace(/^Pario:\s*/i, "").trim()
        : clean.replace(/^Pario:\s*/i, "").trim();

      setChatMessages(prev => [...prev, { role: "assistant", content: finalContent }]);
    } catch (e) {
      const msg = e.name === "AbortError" ? "Request timed out — please try again." : "Something went wrong — please try again.";
      setChatMessages(prev => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setChatBusy(false);
    }
  };

  const doStartChat = async () => {
    const input = answers.freeform?.trim();
    if (!input) return;
    setScopeBullets([]); setBulletsApproved(false);
    setFormalScope(""); setScopeApproved(false); setScopeFlags([]); setExpertQuestions([]);
    setChatMessages([]);
    setInputCollapsed(true);
    await doSendChatMessage(input);
  };

  const doGenerateScope = async () => {
    if (formalScope) setPrevScope(formalScope); // save previous version
    setScopeBusy(true); setScopeErr(""); setScopeFlags([]); setScopeApproved(false);
    try {
      const p = answers.companyProfile || tenantProfileRef.current;
      const companyCtx = p ? [
        p.name && `Company: ${p.name}`,
        p.vertical && `Industry: ${p.vertical}${p.subVertical ? ` — ${p.subVertical}` : ""}`,
        p.employeeCount && `Employees: ${p.employeeCount}`,
        p.hq && `HQ: ${p.hq}`,
        p.publicPrivate && `Type: ${p.publicPrivate}${p.ticker ? ` (${p.ticker})` : ""}`,
        p.knownTechStack?.length && `Known tech: ${p.knownTechStack.join(", ")}`,
        p.regulatoryContext && `Regulatory context: ${p.regulatoryContext}`,
      ].filter(Boolean).join("\n") : "";
      const bulletText = scopeBullets.length > 0
        ? scopeBullets.map(b => `• ${b}`).join("\n")
        : (answers.freeform || FIVE_WS.map(w => answers[w.key]).filter(Boolean).join("\n"));
      const userMsg = companyCtx ? `${companyCtx}\n\nApproved scope bullets:\n${bulletText}` : `Scope bullets:\n${bulletText}`;
      const scope = await callClaude(P_SCOPE_GENERATE, userMsg, false, null, getIdentity());
      setFormalScope(scope.trim());
      setBulletsCollapsed(true);
      await doEvaluateScope(scope.trim());
    } catch { setScopeErr("Could not generate scope. Please try again."); }
    finally { setScopeBusy(false); }
  };

  const doCompanyLookup = async (url) => {
    if (!url?.trim()) return;
    setCompanyLookupBusy(true); setCompanyLookupErr("");
    setAnswers(p => ({ ...p, companyProfile: null }));
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCompanyLookupErr(data.error?.message || "Could not read that URL — try the homepage or about page.");
        return;
      }
      // Parse the profile JSON from the response
      const text = data.profile || "";
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenceMatch ? fenceMatch[1].trim() : text;
      const objMatch = candidate.match(/\{[\s\S]*\}/);
      const profile = JSON.parse(objMatch ? objMatch[0] : candidate);
      setAnswers(p => ({ ...p, companyProfile: profile }));
    } catch {
      setCompanyLookupErr("Could not read that URL — try the homepage or about page.");
    } finally {
      setCompanyLookupBusy(false);
    }
  };

  const doEvaluateScope = async (scopeText) => {
    try {
      const result = await callJSON(P_SCOPE_EVALUATE, `Scope to evaluate:\n\n${scopeText}`, false, null, getIdentity());
      if (result.passed && result.flags.length === 0) {
        setScopeFlags([]);
        setFlagResponses({});
        // Fire expert questions
        try {
          const eq = await callJSON(P_SCOPE_EXPERT, `Scope:\n\n${scopeText}`, false, null, getIdentity());
          if (eq && eq.length > 0) {
            setExpertQuestions(eq);
            setExpertApproved(false);
          } else {
            setExpertApproved(true);
          }
        } catch {
          setExpertApproved(true); // fail open
        }
      } else {
        setScopeFlags(result.flags || []);
        setFlagResponses({});
        setScopeApproved(false);
      }
    } catch {
      setScopeFlags([]);
      setScopeApproved(true);
      logEvent("scope_approved", { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id });
    }
  };

  const doSubmitExpertAnswers = async () => {
    setScopeBusy(true); setScopeErr("");
    try {
      const answered = expertQuestions.filter(q => {
        const r = expertResponses[q.question] || "";
        return r.trim().length > 0 && r.trim().toLowerCase() !== "skip";
      });
      if (answered.length === 0) {
        setExpertQuestions([]);
        setScopeApproved(true);
        setScopeBusy(false);
        return;
      }
      const additions = answered.map(q => `EXPERT QUESTION: ${q.question}\nUSER RESPONSE: ${expertResponses[q.question]}`).join("\n\n");
      const refined = await callClaude(P_SCOPE_REFINE, `EXISTING SCOPE:\n${formalScope}\n\nADDITIONAL INFORMATION:\n${additions}`, false, null, getIdentity());
      setFormalScope(refined.trim());
      setExpertQuestions([]);
      setExpertResponses({});
      // Re-evaluate the refined scope — keep iterating until it passes
      await doEvaluateScope(refined.trim());
    } catch { setScopeErr("Could not refine scope. Please try again."); }
    finally { setScopeBusy(false); }
  };

  const doRefineScope = async () => {
    setScopeBusy(true); setScopeErr("");
    try {
      const activeFlags = scopeFlags.filter((_, idx) => !isSkipped(flagResponses[idx] || ""));
      if (activeFlags.length === 0) { setScopeFlags([]); setScopeApproved(true); setScopeBusy(false); return; }
      const additions = scopeFlags.map((f, idx) => {
        const val = flagResponses[idx] || "";
        if (isSkipped(val)) return null;
        return `GAP: ${f.issue}\nUSER RESPONSE: ${val}`;
      }).filter(Boolean).join("\n\n");
      const refined = await callClaude(P_SCOPE_REFINE, `EXISTING SCOPE:\n${formalScope}\n\nADDITIONAL INFORMATION:\n${additions}`);
      setFormalScope(refined.trim()); setFlagResponses({});
      await doEvaluateScope(refined.trim());
    } catch { setScopeErr("Could not refine scope. Please try again."); }
    finally { setScopeBusy(false); }
  };

  // ── Requirements ──
  const doGenerateReqs = async () => {
    if (requirements.length) setPrevRequirements(requirements); // save previous version
    setReqsBusy(true); setReqsErr("");
    try {
      const arr = await callJSON(P_REQS, `Scope: ${formalScope}`, false, null, getIdentity());
      setRequirements(arr);
      logEvent("requirements_generated", { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id, meta: { count: arr.length } });
    }
    catch { setReqsErr("Could not generate requirements. Please try again."); }
    finally { setReqsBusy(false); }
  };

  const addReq = () => { if (!newReq.trim()) return; setRequirements(p => [...p, { id: `R-C${p.length + 1}`, text: newReq.trim() }]); setNewReq(""); };
  const deleteReq = (id) => setRequirements(p => p.filter(r => r.id !== id));
  const saveEdit = (id) => { setRequirements(p => p.map(r => r.id === id ? { ...r, text: editText } : r)); setEditId(null); };

  // ── Questions ──
  const doGenerateQuestions = async () => {
    setQBusy(true); setQErr("");
    try {
      const P_QS_BATCH = `You are a business analyst writing a vendor discovery questionnaire.

For each requirement provided, generate 2-3 follow-up questions that unpack the implementation detail behind it.

RULES:
- Ask about specifics intentionally left out of the requirement (fields, methods, integrations, sub-features)
- Use multiple choice when the answer space is finite and predictable
- Use open-ended when the answer requires explanation or varies by vendor
- Do not re-ask the requirement itself — assume the vendor said yes
- Use the EXACT requirement ID as the key (e.g. if the ID is "R-F1", the key must be "R-F1")

Return ONLY a valid JSON object. No markdown, no code fences, no explanation. Start with { and end with }.
Example format:
{"R-F1":[{"type":"open_ended","text":"..."},{"type":"multiple_choice","text":"...","options":["A","B","C"]}],"R-F2":[...]}`;

      const reqPayload = requirements.map(r => `${r.id}: ${r.text}`).join("\n");
      const raw = await callClaude(P_QS_BATCH, `Requirements:\n${reqPayload}`, false, null, getIdentity());

      // Strip any markdown fences and parse
      const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
      const objMatch = clean.match(/\{[\s\S]*\}/);
      if (!objMatch) throw new Error(`No JSON object found in response`);
      const out = JSON.parse(objMatch[0]);
      setQuestions(out);
    } catch (e) {
      console.error("Question generation error:", e);
      setQErr("Could not generate questions. Please try again.");
    }
    finally { setQBusy(false); }
  };

  const [reqDragId, setReqDragId] = useState(null);
  const [reqDragOverId, setReqDragOverId] = useState(null);

  const onReqDragStart = (id) => setReqDragId(id);
  const onReqDragOver = (e, id) => { e.preventDefault(); setReqDragOverId(id); };
  const onReqDrop = (e, targetId) => {
    e.preventDefault();
    if (!reqDragId || reqDragId === targetId) { setReqDragId(null); setReqDragOverId(null); return; }
    setRequirements(prev => {
      const arr = [...prev];
      const from = arr.findIndex(r => r.id === reqDragId);
      const to = arr.findIndex(r => r.id === targetId);
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    setReqDragId(null); setReqDragOverId(null);
  };
  const updateActivity = (id, field, val) => {
    setActivities(prev => {
      const arr = prev.map(a => {
        if (a.id !== id) return a;
        const next = { ...a, [field]: val };

        if (field === "startDate") {
          const dur = a.startDate && a.endDate ? calDaysBetween(a.startDate, a.endDate) : (a.offsetDays ?? 7);
          next.endDate = addCalDays(val, dur);
          next.startOffsetDays = rfpStart ? calDaysBetween(rfpStart, val) : 0;
          next.offsetDays = dur;
        }
        if (field === "endDate") {
          if (a.startDate) next.offsetDays = calDaysBetween(a.startDate, val);
        }
        if (field === "offsetDays") {
          if (a.startDate) next.endDate = addCalDays(a.startDate, parseInt(val) || 0);
        }
        return next;
      });

      // Cascade start/end date changes to children
      if (field === "startDate" || field === "endDate") {
        const parent = arr.find(a => a.id === id);
        const original = prev.find(a => a.id === id);
        if (parent && original) {
          const delta = field === "startDate"
            ? calDaysBetween(original.startDate, parent.startDate)
            : calDaysBetween(original.endDate, parent.endDate);

          if (delta !== 0) {
            return arr.map(a => {
              if (a.parentId !== id) return a;
              return {
                ...a,
                startDate: a.startDate ? addCalDays(a.startDate, delta) : a.startDate,
                endDate:   a.endDate   ? addCalDays(a.endDate,   delta) : a.endDate,
                startOffsetDays: rfpStart && a.startDate ? calDaysBetween(rfpStart, addCalDays(a.startDate, delta)) : a.startOffsetDays,
              };
            });
          }
        }
      }

      return arr;
    });
  };

  const deleteActivity = (id) => setActivities(p => p.filter(a => a.id !== id && a.parentId !== id));

  const addActivity = () => {
    if (!newActName.trim()) return;
    setActivities(p => [...p, { id: uid(), group: newActGroup, parentId: null, name: newActName.trim(), startDate: today(), endDate: addCalDays(today(), 7), offsetDays: 7 }]);
    setNewActName("");
  };

  const toggleGroup = (g) => setCollapsedGroups(p => ({ ...p, [g]: !p[g] }));

  // Drag handlers
  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setActivities(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(a => a.id === dragId);
      const toIdx = arr.findIndex(a => a.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      // Move group to match target
      const targetGroup = arr[toIdx].group;
      const [moved] = arr.splice(fromIdx, 1);
      moved.group = targetGroup;
      if (moved.parentId) moved.parentId = null; // reset parent on drag
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDragId(null); setDragOverId(null);
  };

  // ── Market research ──
  const doMarketResearch = async () => {
    setMarketBusy(true); setMarketErr("");
    try {
      const reqList = requirements.length > 0
        ? `\n\nFunctional requirements (${requirements.length} total):\n${requirements.map(r => r.text).join("\n")}`
        : "";
      const p = answers.companyProfile || tenantProfileRef.current;
      const companyCtx = p ? [
        p.name && `Company: ${p.name}`,
        p.vertical && `Industry: ${p.vertical}${p.subVertical ? ` — ${p.subVertical}` : ""}`,
        p.hq && `HQ: ${p.hq}`,
        p.regulatoryContext && `Regulatory obligations: ${p.regulatoryContext}`,
        p.description && `About: ${p.description}`,
      ].filter(Boolean).join("\n") : null;
      const userMsg = `Project scope:\n${formalScope}${reqList}`;
      const result = await callJSON(P_MARKET(companyCtx), userMsg, false, "claude-haiku-4-5-20251001", getIdentity());
      setVendors(result);
      setVendorStatus({});
      logEvent("market_research_run", { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id, meta: { vendorCount: result.length } });
    } catch (e) {
      setMarketErr(`Market research failed: ${e.message}`);
    } finally {
      setMarketBusy(false);
    }
  };

  const doGenerateNarrative = async () => {
    setNarrativeBusy(true);
    try {
      const bulletText = scopeBullets.length > 0
        ? `Scope bullets:\n${scopeBullets.map(b => `• ${b}`).join("\n")}`
        : `Scope:\n${formalScope}`;
      const timelineCtx = rfpStart && goLive
        ? `\n\nTimeline: Start ${new Date(rfpStart + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, Go-live ${new Date(goLive + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (${Math.round(calDaysBetween(rfpStart, goLive) / 7)} weeks)`
        : "";
      const shortlisted = vendors.filter(v => vendorStatus[v.name] === "shortlisted");
      const vendorCtx = vendors.length > 0 ? `\n\nVendor market: ${vendors.length} vendors identified${shortlisted.length > 0 ? `, ${shortlisted.length} shortlisted` : ""}. ${
        vendors.filter(v => v.estimatedPrice && v.estimatedPrice !== "Contact for pricing").map(v => v.estimatedPrice).slice(0, 3).join(", ")
      }${vendors.some(v => v.estimatedPrice) ? " estimated Year 1 cost range." : ""}` : "";
      const userMsg = `${bulletText}${timelineCtx}${vendorCtx}`;
      const result = await callClaude(P_NARRATIVE, userMsg, false, "claude-sonnet-4-5", getIdentity());
      setNarrative(result.trim());
      logEvent("narrative_generated", { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id });
    } catch { /* silent fail */ }
    finally { setNarrativeBusy(false); }
  };

  // ── Auto-generate on tab arrival ──────────────────────────
  useEffect(() => {
    if (view === "requirements" && formalScope && requirements.length === 0 && !reqsBusy) {
      doGenerateReqs();
    }
    if (view === "questions" && requirements.length > 0 && Object.keys(questions).length === 0 && !qBusy) {
      doGenerateQuestions();
    }
    if (view === "market" && formalScope && vendors.length === 0 && !marketBusy) {
      doMarketResearch();
    }
    if (view === "summary" && formalScope && !narrative && !narrativeBusy) {
      doGenerateNarrative();
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const getIdentity = () => ({
    userId: authUser?.id,
    tenantId: userProfile?.tenant_id,
    sessionId,
  });

  const doLogFeedback = (type, value) => {
    const setters = { scope: setScopeFeedback, requirements: setReqsFeedback, vendors: setVendorsFeedback };
    setters[type]?.(value);
    logEvent(`feedback_${value}`, { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id, meta: { type } });
  };

  const toggleVendorStatus = (name, status) => {
    setVendorStatus(p => ({ ...p, [name]: p[name] === status ? null : status }));
  };

  // ── Export ──
  const doExport = async () => {
    setExportBusy(true); setExportErr("");
    try {
      await buildDocx({ sessionId, projectTitle, formalScope, narrative, requirements, questions, activities, rfpStart, goLive, vendors, vendorStatus, userProfile });
      await doSave("complete");
      logEvent("docx_exported", { sessionId, userId: authUser?.id, tenantId: userProfile?.tenant_id });
    } catch { setExportErr("Export failed. Please try again."); }
    finally { setExportBusy(false); }
  };

  const pct = (step / 3) * 100;
  const NAV_VIEWS = ["scope", "requirements", "questions", "market", "timeline", "summary"];
  const NAV_LABELS = ["Scope", "Requirements", "Questions", "Market", "Timeline", "Summary"];
  const answeredReqs = Object.keys(questions).length;
  const openQ = Object.values(questions).flat().filter(q => q.type === "open_ended").length;
  const mcQ = Object.values(questions).flat().filter(q => q.type === "multiple_choice").length;

  const topbarTitles = {
    splash: "Home", sessions: "Projects",
    scope: "Scope", requirements: "Requirements", questions: "Questions",
    market: "Market Research", timeline: "Timeline", summary: "Summary",
  };
  const topbarSubs = {
    splash: "Pario", sessions: "All projects",
    scope: projectTitle || "Untitled project",
    requirements: projectTitle || "Untitled project",
    questions: projectTitle || "Untitled project",
    market: (projectTitle || "Untitled project") + " ",
    timeline: projectTitle || "Untitled project",
    summary: (projectTitle || "Untitled project") + " ",
  };

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="rq-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader size={24} className="spin" style={{ color: "#C2410C" }} />
      </div>
    );
  }

  // ── Login screen ──
  if (!authUser) {
    return <LoginScreen onUnconfirmed={() => setEmailUnconfirmed(true)} />;
  }

  // ── Email not confirmed ──
  if (emailUnconfirmed) {
    return (
      <div className="rq-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 400, padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Check your email</div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 14, color: "#6B7280", lineHeight: 1.7, marginBottom: 24 }}>We sent you a confirmation link. Click it to activate your account, then come back and sign in.</div>
          <button className="rq-btn-ghost" onClick={() => setEmailUnconfirmed(false)}>Back to sign in</button>
        </div>
      </div>
    );
  }

  // ── First login — profile setup ──
  if (authUser && userProfile !== null && !userProfile?.name) {
    return <ProfileSetupScreen onComplete={(profile) => setUserProfile(p => ({ ...p, ...profile }))} />;
  }

  // ── Splash ──
  if (view === "splash") {
    return (
      <div className="rq-root">
        <div className="rq-shell">
          <div className="rq-sidebar">
            <div className="rq-sidebar-logo" style={{ cursor: "pointer" }} onClick={() => setView("splash")}>
              <div className="rq-sidebar-brand">Pario</div>
              {tenantBrandName && (
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 3 }}>{tenantBrandName}</div>
              )}
            </div>
            <div className="rq-nav">
              <div className="rq-nav-item active"><div className="rq-nav-num" style={{ fontSize: 8 }}>⌂</div>Home</div>
              <div className="rq-nav-item" onClick={() => setView("sessions")}><div className="rq-nav-num" style={{ fontSize: 8 }}>S</div>Projects</div>
            </div>
          </div>
          <div className="rq-main">
            <div className="rq-topbar">
              <div className="rq-topbar-left">
                <div className="rq-topbar-title">Home</div>
              </div>
            </div>
            <div className="rq-content" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px" }}>

              {/* Hero */}
              <div style={{ marginBottom: 52 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#C2410C", marginBottom: 14 }}>
                  Pario{tenantBrandName ? ` · ${tenantBrandName}` : ""}
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 800, color: "#111827", lineHeight: 1.12, marginBottom: 16 }}>Build the business case.<br />Own the conversation.</div>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 15, color: "#C2410C", lineHeight: 1.6, marginBottom: 12, fontStyle: "italic" }}>
                  "Software buying moves pretty fast. If you don't stop and define what you need, vendors will define it for you."
                </div>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 16, color: "#6B7280", lineHeight: 1.75, marginBottom: 28, maxWidth: 560 }}>
                  Pario gives any business leader the structured thinking required to evaluate software on their own terms, not the vendor's.
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button className="rq-btn-primary" style={{ padding: "13px 28px", fontSize: 13 }} onClick={resetSession}>
                    <Plus size={15} /> Start new project
                  </button>
                  <button className="rq-btn-ghost" style={{ padding: "13px 20px" }} onClick={() => setView("sessions")}>View projects</button>
                </div>
              </div>

              {/* What it does */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 40, marginBottom: 48 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 24 }}>What it does</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {[
                    { n: "01", title: "Scope", body: "Describe the business problem. The agent drafts a formal scope, evaluates it for quality, and iterates until it meets the bar." },
                    { n: "02", title: "Requirements", body: "Generates binary success criteria — yes/no questions vendors must answer. No narratives, no wiggle room." },
                    { n: "03", title: "Due Diligence", body: "Discovery questions per requirement that expose how vendors actually implement each capability." },
                    { n: "04", title: "Market Survey", body: "Agent-identified vendor shortlist with pricing signals and requirements fit — mainstream and niche categories alike." },
                    { n: "05", title: "Buying Timeline", body: "Buying timeline calibrated to your channel with a Gantt chart ready to share." },
                    { n: "06", title: "Business Case", body: "Narrative, vendor comparison, and pricing estimates formatted for executive presentation or internal alignment." },
                  ].map(s => (
                    <div key={s.n} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "18px 20px" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#C2410C", marginBottom: 6 }}>{s.n}</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{s.title}</div>
                      <div style={{ fontFamily: "'Lora',serif", fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>{s.body}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 12, color: "#9CA3AF", lineHeight: 1.7, maxWidth: 420 }}>
                  Pario encodes 20 years of software buying experience into a structured workflow. The methodology is simple: define what you need before vendors tell you what you want.
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#D1D5DB", paddingTop: 4 }}>Pario</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Shared sidebar ──
  const sidebarNav = (
    <>
      <div className={`rq-sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <div className={`rq-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="rq-sidebar-logo" style={{ cursor: "pointer", padding: "16px 20px" }} onClick={() => setView("splash")}>
        <div className="rq-sidebar-brand">Pario</div>
        {tenantBrandName && (
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 3, letterSpacing: ".01em" }}>
            {tenantBrandName}
          </div>
        )}
      </div>
      <div className="rq-nav">
        {NAV_VIEWS.map((v, i) => {
          const isScope = v === "scope";
          const locked = !formalScope && !isScope;
          return (
            <div key={v}
              className={`rq-nav-item ${view === v ? "active" : ""} ${locked ? "locked" : ""}`}
              onClick={() => { if (!locked) { setView(v); setSidebarOpen(false); } }}
              title={locked ? "Complete your scope first" : ""}
              style={{ opacity: locked ? 0.35 : 1, cursor: locked ? "default" : "pointer" }}
            >
              <div className="rq-nav-num">{i + 1}</div>
              {NAV_LABELS[i]}
            </div>
          );
        })}
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "10px 0" }} />
        <div className={`rq-nav-item ${view === "sessions" ? "active" : ""}`} onClick={() => { setView("sessions"); setSidebarOpen(false); }}>
          <div className="rq-nav-num" style={{ fontSize: 8 }}>S</div>Projects
        </div>
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "10px 0" }} />
        <div className="rq-nav-item" onClick={() => { setView("splash"); setSidebarOpen(false); }}>
          <div className="rq-nav-num"><ArrowLeft size={9} /></div>Home
        </div>
      </div>
      {/* Profile footer */}
      {authUser && (
        <div className="rq-sidebar-footer">
          <div
            onClick={() => { setProfileEditName(userProfile?.name || ""); setProfileEditTitle(userProfile?.title || ""); setShowProfileModal(true); setSidebarOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 6, transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FFF7ED", border: "1px solid #FDBA74", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700, color: "#C2410C" }}>
                {(userProfile?.name || authUser?.email || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userProfile?.name || authUser?.email?.split("@")[0] || "Profile"}
              </div>
              {userProfile?.title && <div style={{ fontFamily: "'Lora',serif", fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userProfile.title}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );

  const topbar = (
    <div>
      <div className="rq-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="rq-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect y="3" width="18" height="2" rx="1" fill="currentColor"/><rect y="8" width="18" height="2" rx="1" fill="currentColor"/><rect y="13" width="18" height="2" rx="1" fill="currentColor"/></svg>
          </button>
          <div className="rq-topbar-left">
            <div className="rq-topbar-title">{projectTitle || topbarTitles[view] || "Untitled project"}</div>
            <div className="rq-topbar-sub">{topbarTitles[view] || ""}</div>
          </div>
        </div>
        <div className="rq-topbar-right">
          <div className={`sv-status ${saveStatus === "idle" ? "" : saveStatus}`} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
            {saveStatus === "saving" && <><Loader size={11} className="spin" /> Saving…</>}
            {saveStatus === "saved" && <span className="rq-save-chip"><CheckCircle size={11} /> Saved</span>}
            {saveStatus === "error" && <span style={{ color: "#e07070" }}>Save failed</span>}
            {saveStatus === "idle" && lastSaved && <span style={{ color: "#9CA3AF" }}><Clock size={11} style={{ display: "inline", marginRight: 4 }} />{lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <button className="rq-btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => {
            if (formalScope || scopeBullets.length > 0 || chatMessages.length > 0) {
              if (!window.confirm("Start a new project? Your current project will remain saved.")) return;
            }
            resetSession();
            setView("scope");
          }}><Plus size={11} /> New project</button>
          {view !== "sessions" && view !== "splash" && (
            <>
              <button className="rq-btn-ghost" onClick={() => doSave("draft")} disabled={saveStatus === "saving"}><Save size={11} /> Save</button>
              <button className="rq-btn-icon rq-btn-del" onClick={doDeleteCurrentSession} title="Delete this project"><Trash2 size={13} /></button>
            </>
          )}
          {view !== "sessions" && view !== "splash" && (
            <button className="rq-export-btn" onClick={doExport} disabled={!formalScope || exportBusy}>
              {exportBusy ? <Loader size={14} className="spin" /> : <FileText size={14} />} <span>Export .docx</span>
            </button>
          )}
        </div>
      </div>
      {/* Step progress bar — only shown inside a project */}
      {view !== "sessions" && view !== "splash" && (
        <div className="rq-step-bar">
          {NAV_VIEWS.map((v, i) => {
            const isActive = view === v;
            const isDone = NAV_VIEWS.indexOf(view) > i;
            const isLocked = !formalScope && v !== "scope";
            const state = isLocked ? "locked" : isDone ? "done" : isActive ? "active" : "locked";
            return (
              <div key={v} className="rq-step-item">
                {i > 0 && <div className={`rq-step-connector ${isDone || (NAV_VIEWS.indexOf(view) >= i) ? "done" : ""}`} />}
                <div
                  className={`rq-step-dot ${state}`}
                  onClick={() => { if (!isLocked) setView(v); }}
                  style={{ cursor: isLocked ? "default" : "pointer" }}
                  title={isLocked ? "Complete scope first" : NAV_LABELS[i]}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                {isActive && <span className={`rq-step-label ${state}`}>{NAV_LABELS[i]}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="rq-root">
      {/* Profile edit modal */}
      {showProfileModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "28px 28px 24px", width: "100%", maxWidth: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Edit profile</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Name</div>
              <input className="rq-input" value={profileEditName} onChange={e => setProfileEditName(e.target.value)} placeholder="Your name" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6 }}>Title <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
              <input className="rq-input" value={profileEditTitle} onChange={e => setProfileEditTitle(e.target.value)} placeholder="Your title" onKeyDown={async e => { if (e.key === "Enter") { setProfileSaving(true); const ok = await saveUserProfile({ name: profileEditName.trim(), title: profileEditTitle.trim(), role: userProfile?.role || "buyer" }); if (ok) { setUserProfile(p => ({ ...p, name: profileEditName.trim(), title: profileEditTitle.trim() })); setShowProfileModal(false); } setProfileSaving(false); }}} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
              <button className="rq-btn-ghost" style={{ fontSize: 12 }} onClick={signOut}>Sign out</button>
              <button className="rq-btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button className="rq-btn-primary" style={{ fontSize: 12 }} disabled={profileSaving || !profileEditName.trim()} onClick={async () => { setProfileSaving(true); const ok = await saveUserProfile({ name: profileEditName.trim(), title: profileEditTitle.trim(), role: userProfile?.role || "buyer" }); if (ok) { setUserProfile(p => ({ ...p, name: profileEditName.trim(), title: profileEditTitle.trim() })); setShowProfileModal(false); } setProfileSaving(false); }}>
                {profileSaving ? <><Loader size={11} className="spin" /> Saving…</> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rq-shell">
        {sidebarNav}
        <div className="rq-main">
          {topbar}
          <div className="rq-content">

            {/* ── Loading skeleton ── */}
            {sessionLoading && (
              <div className="rq-fade">
                <div className="rq-skeleton" style={{ height: 24, width: "40%", marginBottom: 20 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "100%", marginBottom: 10 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "90%", marginBottom: 10 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "95%", marginBottom: 10 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "70%", marginBottom: 28 }} />
                <div className="rq-skeleton" style={{ height: 80, width: "100%", marginBottom: 20 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "60%", marginBottom: 10 }} />
                <div className="rq-skeleton" style={{ height: 14, width: "80%", marginBottom: 10 }} />
              </div>
            )}

            {/* ── Projects ── */}
            {view === "sessions" && (
              <div className="rq-fade">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div className="rq-section-label" style={{ marginBottom: 0 }}>{sessionsList.length} project{sessionsList.length !== 1 ? "s" : ""}</div>
                </div>
                {sessionsLoading && <div className="rq-loading-center"><Loader size={18} className="spin" /></div>}
                {!sessionsLoading && sessionsList.length === 0 && (
                  <div style={{ textAlign: "center", padding: "56px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12 }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>📂</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>No projects yet</div>
                    <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>Use the <strong>New project</strong> button in the header to get started.</div>
                  </div>
                )}
                {!sessionsLoading && sessionsList.length > 0 && (
                  <div className="sessions-panel">
                    <div className="sessions-header"><div className="sessions-title">All projects</div></div>
                    {sessionsList.map(s => (
                      <div className="session-row" key={s.id} onClick={() => doLoadSession(s.id)}>
                        <div style={{ minWidth: 0 }}>
                          <div className="session-name">{s.project_title || "Untitled"}</div>
                          <div className="session-meta">Updated {new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {new Date(s.updated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span className={`session-status ${s.status}`}>{s.status}</span>
                          <button className="rq-btn-icon rq-btn-del" onClick={(e) => doDeleteSession(s.id, e)} style={{ padding: "5px 7px" }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Timeline ── */}
            {view === "timeline" && (
              <div className="rq-fade">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <p className="rq-hint" style={{ marginBottom: 0, flex: 1 }}>Set your start and go-live dates — all activity dates cascade automatically.</p>
                  {buyingChannel && (
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 4, background: buyingChannel === "sole-source" ? "#FFFBEB" : "#FFF7ED", color: buyingChannel === "sole-source" ? "#D97706" : "#C2410C", whiteSpace: "nowrap" }}>
                      {buyingChannel === "sole-source" ? "Sole Source" : "Competitive Bid"}
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
                  <div style={{ background: "#FFFFFF", border: "1px solid rgba(194,65,12,0.2)", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#C2410C", marginBottom: 6 }}>Project Start</div>
                    <input type="date" className="rq-input" value={rfpStart} onChange={e => handleRfpStartChange(e.target.value)} />
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, color: "#9CA3AF", marginTop: 5 }}>Drives all activity dates</div>
                  </div>
                  <div style={{ background: "#FFFFFF", border: "1px solid rgba(239,159,39,0.2)", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#D97706", marginBottom: 6 }}>Go-Live Date</div>
                    <input type="date" className="rq-input" value={goLive} onChange={e => handleGoLiveChange(e.target.value)} />
                    {rfpStart && goLive && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#6B7280", marginTop: 5 }}>{calDaysBetween(rfpStart, goLive)} calendar days total</div>}
                  </div>
                </div>

                {/* Buying channel selector */}
                <div style={{ marginBottom: 22 }}>
                  <div className="rq-section-label" style={{ marginBottom: 6 }}>Buying channel</div>
                  <p className="rq-hint" style={{ marginBottom: 12 }}>
                    {buyingChannel === "sole-source"
                      ? "Sole source suggested — your scope references a specific vendor or proprietary system. Override below if needed."
                      : "Competitive bid suggested based on your scope. Override below if needed."}
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[
                      { id: "competitive-bid", label: "Competitive Bid", desc: "Full process, multiple vendors, evaluation and scoring." },
                      { id: "sole-source",     label: "Sole Source",     desc: "Single vendor, direct negotiation, no competitive process." },
                    ].map(ch => (
                      <div
                        key={ch.id}
                        onClick={() => doSelectChannel(ch.id)}
                        style={{
                          flex: 1, minWidth: 160, padding: "12px 14px",
                          background: buyingChannel === ch.id ? "#FFF7ED" : "#FFFFFF",
                          border: `1.5px solid ${buyingChannel === ch.id ? "#C2410C" : "rgba(0,0,0,0.07)"}`,
                          borderRadius: 8, cursor: "pointer", transition: "all .15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${buyingChannel === ch.id ? "#C2410C" : "#D1D5DB"}`, background: buyingChannel === ch.id ? "#C2410C" : "transparent", flexShrink: 0 }} />
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, color: buyingChannel === ch.id ? "#C2410C" : "#374151" }}>{ch.label}</div>
                        </div>
                        <div style={{ fontFamily: "'Lora',serif", fontSize: 11, color: "#6B7280", lineHeight: 1.5, paddingLeft: 20 }}>{ch.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 110px 110px 70px 60px 32px", gap: 6, marginBottom: 6, paddingLeft: 10, paddingRight: 4 }}>
                  <div /><div className="tl-col-hdr">Activity</div><div className="tl-col-hdr">Start</div><div className="tl-col-hdr">End</div><div className="tl-col-hdr">Offset (days)</div><div className="tl-col-hdr">Duration</div><div />
                </div>

                {buyingChannel === "sole-source" ? (
                  // Sole source — flat list, no group headers
                  <div style={{ marginBottom: 14 }}>
                    {activities.map(a => {
                      const dur = a.startDate && a.endDate ? calDaysBetween(a.startDate, a.endDate) : "—";
                      return (
                        <div key={a.id}
                          className={`tl-act-row is-parent${dragId === a.id ? " dragging" : ""}${dragOverId === a.id ? " drag-over" : ""}`}
                          style={{ gridTemplateColumns: "20px 1fr 110px 110px 70px 60px 32px", display: "grid", gap: 6 }}
                          draggable onDragStart={() => onDragStart(a.id)} onDragOver={(e) => onDragOver(e, a.id)} onDrop={(e) => onDrop(e, a.id)}
                        >
                          <div style={{ display: "flex", alignItems: "center", cursor: "grab", color: "#9CA3AF" }}><GripVertical size={13} /></div>
                          <input className="tl-cell-input" value={a.name} onChange={e => updateActivity(a.id, "name", e.target.value)} />
                          <input type="date" className="tl-cell-input" value={a.startDate || ""} onChange={e => updateActivity(a.id, "startDate", e.target.value)} />
                          <input type="date" className="tl-cell-input" value={a.endDate || ""} onChange={e => updateActivity(a.id, "endDate", e.target.value)} />
                          <input type="number" min="0" className="tl-cell-input" style={{ textAlign: "center" }} value={a.offsetDays ?? ""} onChange={e => updateActivity(a.id, "offsetDays", e.target.value)} />
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center" }}>{dur}d</div>
                          <button className="rq-btn-icon rq-btn-del" onClick={() => deleteActivity(a.id)} style={{ padding: "4px 6px" }}><Trash2 size={11} /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Competitive bid — grouped with collapsible headers
                  GROUPS.map(g => {
                    const gas = activities.filter(a => a.group === g);
                    const collapsed = collapsedGroups[g];
                    const colorClass = g === "Pre-RFx" ? "tl-group-pre" : g === "RFx" ? "tl-group-rfx" : "tl-group-post";
                    return (
                      <div key={g} style={{ marginBottom: 14 }}>
                        <div className="tl-group-header" onClick={() => toggleGroup(g)}>
                          <div className={`tl-group-label ${colorClass}`}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GROUP_COLORS[g] }} />
                            {g} <span style={{ fontWeight: 400, color: "#9CA3AF", marginLeft: 4 }}>({gas.length})</span>
                          </div>
                          {collapsed ? <ChevronDown size={13} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={13} style={{ color: "#9CA3AF" }} />}
                        </div>
                        {!collapsed && gas.map(a => {
                          const dur = a.startDate && a.endDate ? calDaysBetween(a.startDate, a.endDate) : "—";
                          return (
                            <div key={a.id}
                              className={`tl-act-row${a.parentId ? " is-child" : " is-parent"}${dragId === a.id ? " dragging" : ""}${dragOverId === a.id ? " drag-over" : ""}`}
                              style={{ gridTemplateColumns: "20px 1fr 110px 110px 70px 60px 32px", display: "grid", gap: 6 }}
                              draggable onDragStart={() => onDragStart(a.id)} onDragOver={(e) => onDragOver(e, a.id)} onDrop={(e) => onDrop(e, a.id)}
                            >
                              <div style={{ display: "flex", alignItems: "center", cursor: "grab", color: "#9CA3AF" }}><GripVertical size={13} /></div>
                              <input className="tl-cell-input" value={a.name} onChange={e => updateActivity(a.id, "name", e.target.value)} style={{ fontStyle: a.parentId ? "italic" : "normal" }} />
                              <input type="date" className="tl-cell-input" value={a.startDate || ""} onChange={e => updateActivity(a.id, "startDate", e.target.value)} />
                              <input type="date" className="tl-cell-input" value={a.endDate || ""} onChange={e => updateActivity(a.id, "endDate", e.target.value)} />
                              <input type="number" min="0" className="tl-cell-input" style={{ textAlign: "center" }} value={a.offsetDays ?? ""} onChange={e => updateActivity(a.id, "offsetDays", e.target.value)} />
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center" }}>{dur}d</div>
                              <button className="rq-btn-icon rq-btn-del" onClick={() => deleteActivity(a.id)} style={{ padding: "4px 6px" }}><Trash2 size={11} /></button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
                <div className="rq-row" style={{ marginTop: 8, marginBottom: 22 }}>
                  <input className="rq-input" placeholder="New activity name…" value={newActName} onChange={e => setNewActName(e.target.value)} onKeyDown={e => e.key === "Enter" && addActivity()} style={{ flex: 1 }} />
                  {buyingChannel !== "sole-source" && (
                    <select style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, padding: "9px 10px", fontFamily: "'Syne',sans-serif", fontSize: 11, color: "#111827", background: "#F9F8F8", outline: "none" }} value={newActGroup} onChange={e => setNewActGroup(e.target.value)}>
                      {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  )}
                  <button className="rq-btn-ghost" onClick={addActivity} disabled={!newActName.trim()} style={{ whiteSpace: "nowrap" }}><Plus size={12} /> Add</button>
                </div>
                <div className="rq-actions" style={{ marginTop: 8, justifyContent: "flex-end" }}>
                  <button className="rq-btn-primary" onClick={() => setView("summary")}>Continue to Summary <ChevronRight size={13} /></button>
                </div>
              </div>
            )}

            {/* ── Market ── */}
            {view === "market" && (
              <div className="rq-fade">
                {!formalScope ? (
                  <div style={{ textAlign: "center", padding: "56px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12 }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>🏪</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Complete your scope first</div>
                    <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#9CA3AF", marginBottom: 24, lineHeight: 1.6 }}>The market survey uses your approved scope to identify the right vendors for your category.</div>
                    <button className="rq-btn-primary" onClick={() => setView("scope")}>Go to scope <ChevronRight size={13} /></button>
                  </div>
                ) : (
                  <>
                    <p className="rq-hint">The agent identifies relevant vendors based on your scope — mainstream and niche categories alike. Ratings and requirements fit are the agent's assessment based on its knowledge of each vendor. Verify shortlisted vendors on G2 before committing.</p>
                    {vendors.length > 0 && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#9CA3AF", letterSpacing: ".08em", textTransform: "uppercase" }}>Results helpful?</span>
                        <button className="rq-btn-icon" onClick={() => doLogFeedback("vendors", "positive")} style={{ color: vendorsFeedback === "positive" ? "#16A34A" : "#9CA3AF" }}><ThumbsUp size={12} /></button>
                        <button className="rq-btn-icon" onClick={() => doLogFeedback("vendors", "negative")} style={{ color: vendorsFeedback === "negative" ? "#DC2626" : "#9CA3AF" }}><ThumbsDown size={12} /></button>
                      </div>
                    )}
                    {vendors.length > 0 && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                        <div className="rq-metric" style={{ minWidth: 100 }}><div className="rq-metric-label">Vendors found</div><div className="rq-metric-val">{vendors.length}</div></div>
                        <div className="rq-metric" style={{ minWidth: 100 }}><div className="rq-metric-label">Shortlisted</div><div className="rq-metric-val">{Object.values(vendorStatus).filter(s => s === "shortlisted").length}</div></div>
                        <div className="rq-metric" style={{ minWidth: 100 }}><div className="rq-metric-label">Eliminated</div><div className="rq-metric-val">{Object.values(vendorStatus).filter(s => s === "eliminated").length}</div></div>
                      </div>
                    )}
                    {marketErr && <div className="rq-error">{marketErr}</div>}
                    {marketBusy && (
                      <div className="rq-loading-center">
                        <Loader size={28} className="spin" style={{ marginBottom: 12, color: "#C2410C" }} />
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Surveying the market…</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>Identifying vendors for your specific category</div>
                      </div>
                    )}
                    {!marketBusy && vendors.map(v => {
                      const status = vendorStatus[v.name];
                      const matchPct = v.requirementsTotal > 0 ? v.requirementsMatch / v.requirementsTotal : 0;
                      return (
                        <div key={v.name} className={`vendor-card rq-fade${status === "shortlisted" ? " shortlisted" : status === "eliminated" ? " eliminated" : ""}`}>
                          {/* Header row: name + status + search links all on one line */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <div className="vendor-name" style={{ margin: 0, flex: 1, minWidth: 0 }}>
                              <a href={v.vendorUrl || `https://www.google.com/search?q=${encodeURIComponent(v.name + " " + v.category)}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid rgba(93,202,165,0.35)" }}>
                                {v.name}
                              </a>
                            </div>
                            {status === "shortlisted" && <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#C2410C", background: "#FFF7ED", padding: "2px 7px", borderRadius: 3, flexShrink: 0 }}>Shortlisted</span>}
                            {status === "eliminated" && <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#e07070", background: "rgba(184,80,80,0.1)", padding: "2px 7px", borderRadius: 3, flexShrink: 0 }}>Eliminated</span>}
                            {/* Search links — consistent across all cards */}
                            {(() => {
                              const q = encodeURIComponent(v.name.split(" — ").pop());
                              const g2Link = v.g2Url || `https://www.g2.com/search#q=${q}&segment=all`;
                              return (
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                  <a href={g2Link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                                    <button className="vendor-btn vendor-btn-g2" style={{ padding: "2px 6px", fontSize: 9 }}>G2 ↗</button>
                                  </a>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="vendor-category" style={{ marginBottom: 8 }}>{v.category}</div>
                          <div className="vendor-badges">
                            {v.deployment && (
                              <span className={`vendor-badge ${v.deployment === "SaaS" ? "vb-saas" : v.deployment === "On-Prem" ? "vb-onprem" : "vb-hybrid"}`}>
                                {v.deployment}
                              </span>
                            )}
                            {v.pricingModel && (
                              <span className="vendor-badge vb-neutral">{v.pricingModel}</span>
                            )}
                            {v.implementationComplexity && (
                              <span className={`vendor-badge ${v.implementationComplexity === "Low" ? "vb-low" : v.implementationComplexity === "Medium" ? "vb-medium" : "vb-high"}`}>
                                {v.implementationComplexity} impl.
                              </span>
                            )}
                            {v.marketPresence && (
                              <span className={`vendor-badge ${v.marketPresence === "Startup" ? "vb-startup" : v.marketPresence === "Growth" ? "vb-growth" : v.marketPresence === "Established" ? "vb-established" : "vb-legacy"}`}>
                                {v.marketPresence}
                              </span>
                            )}
                          </div>

                          <div className="vendor-meta">
                            {v.g2Rating && v.g2Rating !== "N/A" && (
                              <div className="vendor-rating">
                                <span style={{ color: "#D97706" }}>★</span> {v.g2Rating}
                                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 8, color: "#9CA3AF", marginLeft: 5, letterSpacing: ".05em" }}>agent est.</span>
                              </div>
                            )}
                            {v.g2ReviewCount && v.g2ReviewCount !== "N/A" && <div className="vendor-reviews">{v.g2ReviewCount}</div>}
                          </div>
                          <div className="vendor-desc">{v.description}</div>
                          <div className="vendor-match">
                            <div className={`confidence-dot confidence-${v.matchConfidence || "low"}`} />
                            <div className="vendor-match-bar">
                              <div className={`vendor-match-fill ${v.matchConfidence === "medium" ? "medium" : v.matchConfidence === "low" ? "low" : ""}`} style={{ width: `${matchPct * 100}%` }} />
                            </div>
                            <div className="vendor-match-text">Agent estimates {v.requirementsMatch} of {v.requirementsTotal} requirements met</div>
                          </div>
                          <div className="vendor-actions">
                            <button className={`vendor-btn vendor-btn-shortlist${status === "shortlisted" ? " active" : ""}`} onClick={() => toggleVendorStatus(v.name, "shortlisted")}>{status === "shortlisted" ? "✓ Shortlisted" : "Shortlist"}</button>
                            <button className={`vendor-btn vendor-btn-eliminate${status === "eliminated" ? " active" : ""}`} onClick={() => toggleVendorStatus(v.name, "eliminated")}>{status === "eliminated" ? "✗ Eliminated" : "Eliminate"}</button>
                            <button className="rq-btn-icon rq-btn-del" title="Remove vendor" onClick={() => setVendors(p => p.filter(x => x.name !== v.name))} style={{ padding: "4px 6px", marginLeft: 4 }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {vendors.length > 0 && (
                      <div className="rq-actions" style={{ justifyContent: "space-between", marginTop: 16 }}>
                        <button className="rq-btn-ghost" onClick={doMarketResearch} disabled={marketBusy}><RefreshCw size={11} /> Re-run research</button>
                        <button className="rq-btn-primary" onClick={() => setView("timeline")}>Continue to Timeline <ChevronRight size={13} /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Scope ── */}
            {view === "scope" && (
              <div className="rq-fade">

                {/* Editable project title */}
                <div className="rq-section-label" style={{ marginBottom: 6 }}>Project title</div>
                <input className="rq-input" style={{ marginBottom: 22 }} placeholder="e.g. Enterprise HR Management System" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} />

                <div className="rq-section-label" style={{ marginBottom: 8 }}>What business problem are you trying to solve?</div>

                {/* ── Stage 1: Initial input — always accessible, collapses after chat starts ── */}
                <div style={{ marginBottom: chatMessages.length > 0 || scopeBullets.length > 0 ? 16 : 0 }}>
                  {/* Header — only shown as collapsible after chat has started */}
                  {(chatMessages.length > 0 || scopeBullets.length > 0 || formalScope) && (
                    <div
                      onClick={() => setInputCollapsed(p => !p)}
                      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: inputCollapsed ? 0 : 10, userSelect: "none" }}
                    >
                      {inputCollapsed ? <ChevronDown size={11} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={11} style={{ color: "#9CA3AF" }} />}
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#9CA3AF" }}>
                        {inputCollapsed ? "View initial description" : "Initial description"}
                      </span>
                    </div>
                  )}

                  {/* Textarea — always shown when no chat, collapsible after */}
                  {!inputCollapsed && (
                    <div className="rq-fade">
                      {chatMessages.length === 0 && (
                        <p className="rq-hint" style={{ marginBottom: 12 }}>Describe what you need in your own words — the system, the problem, who will use it, any deadlines or constraints, and what's out of scope. The more context you provide, the better the output.</p>
                      )}
                      <textarea
                        className="rq-textarea"
                        placeholder="e.g. Our HR team manages payroll, benefits, and employee records across three legacy systems that don't talk to each other. We need a single platform to consolidate these by end of 2026. Recruiting and performance management are out of scope..."
                        value={answers.freeform || ""}
                        onChange={e => setAnswers(p => ({ ...p, freeform: e.target.value }))}
                        rows={chatMessages.length > 0 ? 3 : 5}
                        style={{ marginBottom: 10 }}
                      />
                      {chatMessages.length === 0 ? (
                        <div className="rq-actions">
                          <button className="rq-btn-primary" onClick={doStartChat} disabled={!allAnswered || chatBusy || scopeBusy}>
                            {chatBusy ? <><Loader size={13} className="spin" /> Thinking…</> : <>Begin <ChevronRight size={13} /></>}
                          </button>
                        </div>
                      ) : (
                        <div className="rq-actions">
                          <button className="rq-btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                            if (!answers.freeform?.trim()) return;
                            if (window.confirm("Updating your description will restart the conversation. Continue?")) {
                              setChatMessages([]);
                              setScopeBullets([]);
                              setFormalScope("");
                              setScopeApproved(false);
                              setScopeFlags([]);
                              setExpertQuestions([]);
                              setChatInput("");
                              setChatCollapsed(false);
                              setBulletsCollapsed(false);
                              setContinuingChat(false);
                              setInputCollapsed(false);
                              doStartChat();
                            }
                          }}>
                            ↺ Restart with updated description
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Stage 2: Active chat OR collapsed chat history ── */}
                {chatMessages.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {/* Collapsible header */}
                    <div
                      onClick={() => setChatCollapsed(p => !p)}
                      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: chatCollapsed ? 0 : 12, userSelect: "none" }}
                    >
                      {chatCollapsed ? <ChevronDown size={11} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={11} style={{ color: "#9CA3AF" }} />}
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#9CA3AF" }}>
                        {chatCollapsed ? `View conversation (${chatMessages.length} messages)` : "Conversation"}
                      </span>
                    </div>

                    {/* Chat messages */}
                    {!chatCollapsed && (
                      <div className="rq-fade">
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                          {chatMessages.map((msg, idx) => (
                            <div key={idx} style={{ display: "flex", gap: 10, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end" }}>
                              {msg.role === "assistant" && (
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FFF7ED", border: "1px solid #FDBA74", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C2410C" }} />
                                </div>
                              )}
                              <div style={{
                                maxWidth: "78%", padding: "10px 14px",
                                borderRadius: msg.role === "user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
                                background: msg.role === "user" ? "#FFF7ED" : "#FFFFFF",
                                border: msg.role === "user" ? "1px solid #FDBA74" : "1px solid rgba(0,0,0,0.07)",
                                fontSize: 13, lineHeight: 1.55, color: msg.role === "user" ? "#7C2D12" : "#374151",
                                fontFamily: "'Lora',serif",
                              }}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {chatBusy && (
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FFF7ED", border: "1px solid #FDBA74", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C2410C" }} />
                              </div>
                              <div style={{ padding: "10px 14px", borderRadius: "3px 14px 14px 14px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 4, alignItems: "center" }}>
                                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#D1D5DB", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Reply input — shown when chat is active (no bullets yet) OR continuing */}
                        {(!scopeBullets.length || continuingChat) && !chatBusy && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                            <input
                              className="rq-input"
                              style={{ flex: 1, borderRadius: 24, padding: "10px 16px" }}
                              placeholder="Reply… (type 'skip' to skip this question)"
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && !e.shiftKey && doSendChatMessage(chatInput)}
                              autoFocus
                            />
                            <button
                              onClick={() => doSendChatMessage(chatInput)}
                              disabled={!chatInput.trim()}
                              style={{ width: 38, height: 38, borderRadius: "50%", background: chatInput.trim() ? "#C2410C" : "#F3F4F6", border: "none", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s" }}
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke={chatInput.trim() ? "#fff" : "#9CA3AF"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          </div>
                        )}

                        {/* Actions below chat */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {scopeBullets.length > 0 && !continuingChat && (
                            <button className="rq-btn-ghost" style={{ fontSize: 10 }} onClick={() => { setContinuingChat(true); setChatCollapsed(false); }}>
                              + Continue conversation
                            </button>
                          )}
                          <button className="rq-btn-ghost" style={{ fontSize: 10 }} onClick={() => {
                            if (window.confirm("Restart intake? This will clear the conversation, bullets, and scope.")) {
                              setChatMessages([]); setScopeBullets([]); setFormalScope(""); setScopeApproved(false);
                              setScopeFlags([]); setExpertQuestions([]); setChatInput(""); setChatCollapsed(false);
                              setBulletsCollapsed(false); setContinuingChat(false); setAnswers(p => ({ ...p, freeform: "" }));
                            }
                          }}>
                            ↺ Restart intake
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Stage 3: Bullet review ── */}
                {scopeBullets.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {/* Collapsible header */}
                    <div
                      onClick={() => setBulletsCollapsed(p => !p)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: bulletsCollapsed ? 0 : 10, userSelect: "none" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {bulletsCollapsed ? <ChevronDown size={11} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={11} style={{ color: "#9CA3AF" }} />}
                        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#9CA3AF" }}>
                          {bulletsCollapsed ? `View bullets (${scopeBullets.length} points)` : "Here's what I captured"}
                        </span>
                      </div>
                      {!bulletsCollapsed && (
                        <button className="rq-btn-ghost" style={{ fontSize: 9 }} onClick={e => { e.stopPropagation(); if (window.confirm("Restart intake? This will clear the conversation, bullets, and scope.")) { setChatMessages([]); setScopeBullets([]); setFormalScope(""); setScopeApproved(false); setScopeFlags([]); setExpertQuestions([]); setChatInput(""); setChatCollapsed(false); setBulletsCollapsed(false); setContinuingChat(false); setAnswers(p => ({ ...p, freeform: "" })); } }}>↺ Restart intake</button>
                      )}
                    </div>

                    {!bulletsCollapsed && (
                      <div className="rq-fade">
                        <p className="rq-hint" style={{ marginBottom: 14 }}>Click any point to edit it. Add or remove points, then generate your scope.</p>
                        <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                          {scopeBullets.map((bullet, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: idx < scopeBullets.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                              <div style={{ color: "#C2410C", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>·</div>
                              {editId === `bullet-${idx}` ? (
                                <input autoFocus className="rq-input" style={{ flex: 1, padding: "4px 8px", fontSize: 13 }}
                                  value={bullet}
                                  onChange={e => { const b = [...scopeBullets]; b[idx] = e.target.value; setScopeBullets(b); }}
                                  onBlur={() => setEditId(null)}
                                  onKeyDown={e => e.key === "Enter" && setEditId(null)}
                                />
                              ) : (
                                <div onClick={() => setEditId(`bullet-${idx}`)} style={{ flex: 1, fontFamily: "'Lora',serif", fontSize: 13, color: "#374151", lineHeight: 1.55, cursor: "text", padding: "2px 0" }}>
                                  {bullet}
                                </div>
                              )}
                              <button className="rq-btn-icon rq-btn-del" onClick={() => setScopeBullets(p => p.filter((_, i) => i !== idx))} style={{ flexShrink: 0, opacity: 0.4 }}><X size={11} /></button>
                            </div>
                          ))}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px" }}>
                            <div style={{ color: "#D1D5DB", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>+</div>
                            <input className="rq-input"
                              style={{ flex: 1, padding: "4px 8px", fontSize: 13, border: "none", background: "transparent", outline: "none", color: "#9CA3AF" }}
                              placeholder="Add a point…"
                              onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { setScopeBullets(p => [...p, e.target.value.trim()]); e.target.value = ""; }}}
                            />
                          </div>
                        </div>
                        {!formalScope && (
                          <div className="rq-actions">
                            <button className="rq-btn-primary" onClick={doGenerateScope} disabled={scopeBusy || scopeBullets.length === 0}>
                              {scopeBusy ? <><Loader size={13} className="spin" /> Generating scope…</> : <>Generate scope <ChevronRight size={13} /></>}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Typing pulse animation */}
                <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>

                {scopeErr && <div className="rq-error">{scopeErr}</div>}
                {formalScope && (
                  <div style={{ marginTop: 4 }} className="rq-fade">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div className="rq-section-label">Scope</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {prevScope && !editingScope && (
                          <button className="rq-btn-ghost" style={{ fontSize: 9 }} onClick={() => { setFormalScope(prevScope); setPrevScope(null); setScopeApproved(false); setScopeFlags([]); }}>↩ Undo</button>
                        )}
                        {scopeBullets.length > 0 && !editingScope && (
                          <button className="rq-btn-ghost" style={{ fontSize: 9 }} onClick={() => { setBulletsCollapsed(false); doGenerateScope(); }} disabled={scopeBusy}><RefreshCw size={10} /> Regenerate</button>
                        )}
                      </div>
                    </div>
                    {editingScope ? (
                      <>
                        <textarea className="rq-textarea" value={formalScope} onChange={e => setFormalScope(e.target.value)} rows={8} style={{ marginBottom: 10 }} />
                        <div className="rq-actions">
                          <button className="rq-btn-ghost" onClick={async () => { setEditingScope(false); setScopeApproved(false); setScopeFlags([]); setExpertQuestions([]); await doEvaluateScope(formalScope); }}><Check size={12} /> Done editing</button>
                          <button className="rq-btn-ghost" onClick={() => setEditingScope(false)}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rq-scope-box" style={{ whiteSpace: "pre-wrap" }}>
                          {formalScope
                            .replace(/^#{1,3}\s+/gm, '')
                            .replace(/^[-*]\s+/gm, '• ')
                            .replace(/\*\*(.*?)\*\*/g, '$1')
                            .trim()}
                        </div>
                        <div className="rq-actions" style={{ marginTop: 10, justifyContent: "space-between" }}>
                          <button className="rq-btn-ghost" onClick={() => setEditingScope(true)}><Pencil size={12} /> Edit</button>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#9CA3AF", letterSpacing: ".08em", textTransform: "uppercase" }}>Helpful?</span>
                            <button className="rq-btn-icon" onClick={() => doLogFeedback("scope", "positive")} style={{ color: scopeFeedback === "positive" ? "#16A34A" : "#9CA3AF" }}><ThumbsUp size={12} /></button>
                            <button className="rq-btn-icon" onClick={() => doLogFeedback("scope", "negative")} style={{ color: scopeFeedback === "negative" ? "#DC2626" : "#9CA3AF" }}><ThumbsDown size={12} /></button>
                          </div>
                        </div>
                      </>
                    )}
                    {scopeFlags.length > 0 && !editingScope && (
                      <div style={{ marginTop: 18 }} className="rq-fade">
                        <div className="rq-section-label" style={{ marginBottom: 10 }}>Scope review — action required</div>
                        {scopeFlags.map((flag, idx) => {
                          const val = flagResponses[idx] || "";
                          const skipped = isSkipped(val);
                          return (
                            <div className="rq-flag-card" key={idx} style={{ opacity: skipped ? 0.5 : 1 }}>
                              <div className="rq-flag-title"><AlertTriangle size={13} /> {flag.criterion}{skipped && <span style={{ marginLeft: 8, fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#D97706", background: "rgba(239,159,39,0.15)", padding: "2px 7px", borderRadius: 3 }}>SKIPPED</span>}</div>
                              {!skipped && <div className="rq-flag-text">{flag.prompt}</div>}
                              <textarea className="rq-textarea" placeholder={`Your response… (type "skip" to dismiss)`} value={val} onChange={e => setFlagResponses(p => ({ ...p, [idx]: e.target.value }))} rows={skipped ? 1 : 2} style={{ opacity: skipped ? 0.6 : 1 }} />
                            </div>
                          );
                        })}
                        <div className="rq-actions">
                          <button className="rq-btn-primary" onClick={doRefineScope} disabled={scopeBusy || !allFlagResponsesFilled}>
                            {scopeBusy ? <><Loader size={13} className="spin" /> Refining…</> : <>Refine scope <ChevronRight size={13} /></>}
                          </button>
                        </div>
                      </div>
                    )}
                    {scopeApproved && !editingScope && (
                      <div style={{ marginTop: 14 }} className="rq-fade">
                        <div className="rq-scope-approved"><CheckCircle size={15} /> Scope approved — all criteria met</div>
                        <div className="rq-actions">
                          <button className="rq-btn-primary" onClick={() => setView("requirements")}>Continue to Requirements <ChevronRight size={13} /></button>
                        </div>
                      </div>
                    )}
                    {expertQuestions.length > 0 && !scopeApproved && !editingScope && (
                      <div style={{ marginTop: 18 }} className="rq-fade">
                        <div className="rq-section-label" style={{ marginBottom: 4 }}>Expert questions</div>
                        <p className="rq-hint" style={{ marginBottom: 14 }}>These questions will help sharpen the scope. Answer what you can — type "skip" to dismiss any you'd rather not answer.</p>
                        {expertQuestions.map(q => {
                          const val = expertResponses[q.question] || "";
                          const skipped = val.trim().toLowerCase() === "skip";
                          return (
                            <div key={q.question} className="rq-flag-card" style={{ opacity: skipped ? 0.5 : 1, background: "rgba(93,202,165,0.04)", borderColor: "rgba(194,65,12,0.2)" }}>
                              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{q.question}</div>
                              <div style={{ fontFamily: "'Lora',serif", fontSize: 11, color: "#6B7280", fontStyle: "italic", marginBottom: 8 }}>{q.why}</div>
                              <textarea
                                className="rq-textarea"
                                placeholder={`Your answer… (type "skip" to dismiss)`}
                                value={val}
                                onChange={e => setExpertResponses(p => ({ ...p, [q.question]: e.target.value }))}
                                rows={skipped ? 1 : 2}
                                style={{ opacity: skipped ? 0.6 : 1 }}
                              />
                            </div>
                          );
                        })}
                        <div className="rq-actions">
                          <button className="rq-btn-primary" onClick={doSubmitExpertAnswers} disabled={scopeBusy}>
                            {scopeBusy ? <><Loader size={13} className="spin" /> Updating scope…</> : <>Update scope <ChevronRight size={13} /></>}
                          </button>
                          <button className="rq-btn-ghost" onClick={() => { setExpertQuestions([]); setScopeApproved(true); }}>
                            Skip all
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Requirements ── */}
            {view === "requirements" && (
              <div className="rq-fade">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <p className="rq-hint" style={{ marginBottom: 0 }}>Drag to reorder. Edit, delete, or add your own.</p>
                  <button className="rq-btn-ghost" onClick={doGenerateReqs} disabled={reqsBusy}>{reqsBusy ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />} Regenerate</button>
                </div>
                {reqsBusy && (
                  <div className="rq-loading-center">
                    <Loader size={28} className="spin" style={{ marginBottom: 12, color: "#C2410C" }} />
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Generating requirements…</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>Translating your scope into binary requirements</div>
                  </div>
                )}
                {reqsErr && <div className="rq-error">{reqsErr}</div>}
                {!reqsBusy && requirements.length === 0 && !reqsErr && (
                  <div style={{ textAlign: "center", padding: "48px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, marginBottom: 18 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>No requirements yet</div>
                    <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>Generate requirements from your approved scope, or add your own below.</div>
                    <button className="rq-btn-primary" onClick={doGenerateReqs} disabled={!formalScope}>
                      {!formalScope ? "Complete scope first" : <>Generate requirements <ChevronRight size={13} /></>}
                    </button>
                  </div>
                )}
                {!reqsBusy && requirements.map(req => (
                  <div
                    className="rq-card rq-fade"
                    key={req.id}
                    draggable
                    onDragStart={() => onReqDragStart(req.id)}
                    onDragOver={(e) => onReqDragOver(e, req.id)}
                    onDrop={(e) => onReqDrop(e, req.id)}
                    style={{ cursor: "grab", borderColor: reqDragOverId === req.id ? "#C2410C" : undefined, borderStyle: reqDragOverId === req.id ? "dashed" : undefined, opacity: reqDragId === req.id ? 0.5 : 1 }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ color: "#D1D5DB", paddingTop: 2, flexShrink: 0 }}><GripVertical size={13} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rq-req-id">{req.id}</div>
                        {editId === req.id ? (
                          <>
                            <input className="rq-input" value={editText} onChange={e => setEditText(e.target.value)} style={{ marginTop: 8, marginBottom: 10 }} />
                            <div className="rq-row"><button className="rq-btn-ghost" onClick={() => saveEdit(req.id)}><Check size={11} /> Save</button><button className="rq-btn-ghost" onClick={() => setEditId(null)}><X size={11} /> Cancel</button></div>
                          </>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div className="rq-req-text">{req.text}</div>
                            <div className="rq-row" style={{ flexShrink: 0 }}>
                              <button className="rq-btn-icon" onClick={() => { setEditId(req.id); setEditText(req.text); }}><Pencil size={12} /></button>
                              <button className="rq-btn-icon rq-btn-del" onClick={() => deleteReq(req.id)}><Trash2 size={12} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!reqsBusy && (
                  <div className="rq-row" style={{ marginTop: 8 }}>
                    <input className="rq-input" placeholder="Add your own requirement…" value={newReq} onChange={e => setNewReq(e.target.value)} onKeyDown={e => e.key === "Enter" && addReq()} />
                    <button className="rq-btn-ghost" onClick={addReq} disabled={!newReq.trim()} style={{ whiteSpace: "nowrap" }}><Plus size={12} /> Add</button>
                  </div>
                )}
                {!reqsBusy && requirements.length > 0 && (
                  <div style={{ marginTop: 22 }} className="rq-fade">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div className="rq-scope-approved" style={{ marginBottom: 0, flex: 1 }}><CheckCircle size={15} /> Requirements ready — {requirements.length} defined</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 10 }}>
                        {prevRequirements && (
                          <button className="rq-btn-ghost" style={{ fontSize: 9 }} onClick={() => { setRequirements(prevRequirements); setPrevRequirements(null); }}>↩ Undo</button>
                        )}
                        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#9CA3AF", letterSpacing: ".08em", textTransform: "uppercase" }}>Helpful?</span>
                        <button className="rq-btn-icon" onClick={() => doLogFeedback("requirements", "positive")} style={{ color: reqsFeedback === "positive" ? "#16A34A" : "#9CA3AF" }}><ThumbsUp size={12} /></button>
                        <button className="rq-btn-icon" onClick={() => doLogFeedback("requirements", "negative")} style={{ color: reqsFeedback === "negative" ? "#DC2626" : "#9CA3AF" }}><ThumbsDown size={12} /></button>
                      </div>
                    </div>
                    <div className="rq-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <button className="rq-btn-ghost" style={{ fontSize: 9 }} onClick={doGenerateReqs} disabled={reqsBusy || !formalScope}><RefreshCw size={10} /> Regenerate</button>
                      <button className="rq-btn-primary" onClick={() => setView("questions")}>Continue to Questions <ChevronRight size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Questions ── */}
            {view === "questions" && (
              <div className="rq-fade">
                {qErr && <div className="rq-error">{qErr}</div>}
                {qBusy && (
                  <div className="rq-loading-center">
                    <Loader size={28} className="spin" style={{ marginBottom: 12, color: "#C2410C" }} />
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Generating questions…</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>Building discovery questions for {requirements.length} requirement{requirements.length !== 1 ? "s" : ""}</div>
                  </div>
                )}
                {!qBusy && Object.keys(questions).length === 0 && (
                  <div style={{ textAlign: "center", padding: "56px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12 }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                      {requirements.length === 0 ? "No requirements yet" : "Preparing questions…"}
                    </div>
                    <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: "#9CA3AF", marginBottom: 24, lineHeight: 1.6 }}>
                      {requirements.length === 0
                        ? "Complete your scope and requirements first."
                        : "Building your vendor discovery questionnaire."}
                    </div>
                    {requirements.length === 0 && (
                      <button className="rq-btn-ghost" onClick={() => setView("requirements")}>Go to requirements <ChevronRight size={13} /></button>
                    )}
                  </div>
                )}
                {!qBusy && Object.keys(questions).length > 0 && (
                  <>
                    {requirements.map(req => {
                      const qs = questions[req.id] || [];
                      return (
                        <div key={req.id} style={{ marginBottom: 22 }}>
                          <div className="rq-req-group-label">{req.id} — {req.text}</div>
                          {qs.map((q, i) => (
                            <div className="rq-q-card" key={i}>
                              <div className={`rq-badge ${q.type === "open_ended" ? "rq-badge-open" : "rq-badge-mc"}`}>{q.type === "open_ended" ? "Open ended" : "Multiple choice"}</div>
                              <div className="rq-q-text">{q.text}</div>
                              {q.type === "multiple_choice" && q.options?.length && (
                                <div className="rq-mc-opts">{q.options.map((o, j) => <span key={j} className="rq-mc-opt">{String.fromCharCode(65 + j)}. {o}</span>)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className="rq-actions" style={{ justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="rq-btn-ghost" onClick={doGenerateQuestions} disabled={qBusy}><RefreshCw size={11} /> Regenerate</button>
                        <button className="rq-btn-ghost" onClick={() => {
                          const lines = requirements.flatMap(req => {
                            const qs = questions[req.id] || [];
                            return [`\n${req.id}: ${req.text}`, ...qs.map((q, i) => {
                              const opts = q.type === "multiple_choice" && q.options?.length
                                ? "\n" + q.options.map((o, j) => `   ${String.fromCharCode(65+j)}. ${o}`).join("\n")
                                : "\n   [Open response]";
                              return `${i+1}. ${q.text}${opts}`;
                            })];
                          });
                          const blob = new Blob([`${projectTitle || "Questions"}\nVendor Discovery Questionnaire\n${"=".repeat(40)}${lines.join("\n")}`], { type: "text/plain" });
                          saveAs(blob, `${(projectTitle || "questions").replace(/[^a-zA-Z0-9_-]/g, "_")}_questions.txt`);
                        }}>
                          <FileText size={11} /> Export questions
                        </button>
                      </div>
                      <button className="rq-btn-primary" onClick={() => setView("market")}>Continue to Market <ChevronRight size={13} /></button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Review ── */}
            {view === "summary" && (
              <div className="rq-fade">

                {/* Summary tiles */}
                <div className="rq-metrics" style={{ marginBottom: 28 }}>
                  <div className="rq-metric">
                    <div className="rq-metric-label">Requirements</div>
                    <div className="rq-metric-val">{requirements.length || "—"}</div>
                    <div className="rq-metric-sub">{requirements.length > 0 ? "binary" : "none yet"}</div>
                  </div>
                  <div className="rq-metric">
                    <div className="rq-metric-label">Questions</div>
                    <div className="rq-metric-val">{openQ + mcQ || "—"}</div>
                    <div className="rq-metric-sub">{openQ + mcQ > 0 ? `${openQ} open · ${mcQ} mc` : "none yet"}</div>
                  </div>
                  <div className="rq-metric">
                    <div className="rq-metric-label">Vendors shortlisted</div>
                    <div className="rq-metric-val" style={{ color: vendors.length === 0 ? "#9CA3AF" : "#D97706" }}>
                      {vendors.length === 0 ? "—" : vendors.filter(v => vendorStatus[v.name] === "shortlisted").length}
                    </div>
                    <div className="rq-metric-sub amber">{vendors.length === 0 ? "run market first" : `of ${vendors.length} found`}</div>
                  </div>
                  <div className="rq-metric">
                    <div className="rq-metric-label">Timeline</div>
                    <div className="rq-metric-val" style={{ color: "#C2410C" }}>
                      {rfpStart && goLive ? Math.round(calDaysBetween(rfpStart, goLive) / 7) : "—"}
                    </div>
                    <div className="rq-metric-sub">{rfpStart && goLive ? "weeks start to go-live" : "set dates in timeline"}</div>
                  </div>
                </div>

                {/* Business narrative */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="rq-section-label" style={{ marginBottom: 0 }}>Business case narrative</div>
                  {narrative && (
                    <button className="rq-btn-ghost" onClick={doGenerateNarrative} disabled={narrativeBusy || !formalScope} style={{ fontSize: 9 }}>
                      {narrativeBusy ? <><Loader size={10} className="spin" /> Regenerating…</> : <><RefreshCw size={10} /> Regenerate</>}
                    </button>
                  )}
                </div>
                {narrativeBusy && (
                  <div className="rq-loading-center" style={{ marginBottom: 24 }}>
                    <Loader size={20} className="spin" style={{ color: "#C2410C", marginBottom: 8 }} />
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, color: "#9CA3AF" }}>Generating business case…</div>
                  </div>
                )}
                {!narrativeBusy && (narrative
                  ? <div className="rq-scope-box" style={{ marginBottom: 24, whiteSpace: "pre-line" }}>{narrative}</div>
                  : <div style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13, marginBottom: 24 }}>Complete your scope first to generate a narrative.</div>
                )}
                <hr className="rq-divider" />

                {/* Timeline summary */}
                <div className="rq-section-label">Buying timeline</div>
                {rfpStart && goLive ? (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                      <div style={{ background: "#FFFFFF", border: "1px solid rgba(194,65,12,0.2)", borderRadius: 8, padding: "12px 18px", flex: 1, minWidth: 140 }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#C2410C", marginBottom: 4 }}>RFx Start</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#111827" }}>{new Date(rfpStart + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid rgba(239,159,39,0.2)", borderRadius: 8, padding: "12px 18px", flex: 1, minWidth: 140 }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#D97706", marginBottom: 4 }}>Go-Live</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#111827" }}>{new Date(goLive + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </div>
                      <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "12px 18px", flex: 1, minWidth: 140 }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "#6B7280", marginBottom: 4 }}>Total Duration</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#111827" }}>{Math.round(calDaysBetween(rfpStart, goLive) / 7)} weeks</div>
                      </div>
                    </div>
                    <GanttChart activities={activities} />
                  </div>
                ) : (
                  <div style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13, marginBottom: 24 }}>
                    No dates set — go to Timeline to configure your schedule.
                  </div>
                )}
                <hr className="rq-divider" />

                {/* Vendor shortlist */}
                <div className="rq-section-label">Vendor shortlist</div>
                {vendors.length === 0 ? (
                  <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "20px 22px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, color: "#9CA3AF" }}>—</div>
                    <div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>No market research yet</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>Go to Market to search for vendors and score them against your requirements.</div>
                    </div>
                    <button className="rq-btn-ghost" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={() => setView("market")}>Go to Market <ChevronRight size={12} /></button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 24 }}>
                    {vendors.filter(v => vendorStatus[v.name] !== "eliminated").map(v => {
                      const status = vendorStatus[v.name];
                      const matchPct = v.requirementsTotal > 0 ? v.requirementsMatch / v.requirementsTotal : 0;
                      return (
                        <div key={v.name} className={`vendor-card${status === "shortlisted" ? " shortlisted" : ""}`} style={{ cursor: "default" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div>
                              <div className="vendor-name">{v.name}</div>
                              <div className="vendor-category">{v.category}</div>
                            </div>
                            {status === "shortlisted" && <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#C2410C", background: "#FFF7ED", padding: "3px 8px", borderRadius: 3, flexShrink: 0 }}>Shortlisted</span>}
                          </div>
                          <div className="vendor-desc" style={{ marginTop: 6, marginBottom: 8 }}>{v.description}</div>
                          {/* Pricing row */}
                          {v.estimatedPrice && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "7px 10px", background: "#F9F8F8", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500, color: "#111827" }}>{v.estimatedPrice}</div>
                              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#9CA3AF" }}>{v.pricingModel}</div>
                              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.priceConfidence === "high" ? "#C2410C" : v.priceConfidence === "medium" ? "#D97706" : "#D1D5DB" }} />
                                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 9, color: "#9CA3AF" }}>{v.priceConfidence} confidence · agent est.</span>
                              </div>
                            </div>
                          )}
                          <div className="vendor-match">
                            <div className={`confidence-dot confidence-${v.matchConfidence || "low"}`} />
                            <div className="vendor-match-bar">
                              <div className={`vendor-match-fill ${v.matchConfidence === "medium" ? "medium" : v.matchConfidence === "low" ? "low" : ""}`} style={{ width: `${matchPct * 100}%` }} />
                            </div>
                            <div className="vendor-match-text">Agent estimates {v.requirementsMatch} of {v.requirementsTotal} requirements</div>
                            {v.g2Rating && v.g2Rating !== "N/A" && <div className="vendor-rating" style={{ marginLeft: "auto" }}><span style={{ color: "#D97706" }}>★</span> {v.g2Rating}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <hr className="rq-divider" />

                {/* Export */}
                {exportErr && <div className="rq-error" style={{ marginBottom: 16 }}>{exportErr}</div>}
                <button className="rq-btn-primary" onClick={doExport} disabled={!formalScope || exportBusy} style={{ padding: "12px 28px" }}>
                  {exportBusy ? <><Loader size={14} className="spin" /> Exporting…</> : <><FileText size={14} /> Export to .docx</>}
                </button>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
