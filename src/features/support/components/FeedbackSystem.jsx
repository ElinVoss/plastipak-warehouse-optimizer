import React, { useEffect, useState } from "react";
import { MessageSquare, X, Bug, Star, CheckCircle, Loader2, Send } from "lucide-react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mnjbjvjg";

export default function FeedbackSystem({ isOpen, onClose, appContext = {} }) {
  const [type, setType] = useState("BUG");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("IDLE");

  useEffect(() => {
    if (!isOpen) return;
    setStatus("IDLE");
    setType("BUG");
    setMessage("");
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("SUBMITTING");
    const payload = {
      feedback_type: type,
      message: message.trim(),
      warehouse_scope: appContext.warehouse ?? "N/A",
      exclude_r: appContext.excludeRbins ? "YES" : "NO",
      abc_threshold: appContext.abcThreshold ?? "N/A",
      phase2_enabled: appContext.phase2Enabled ? "YES" : "NO",
      phase2_threshold: appContext.phase2Threshold ?? "N/A",
      allow_src_110: appContext.allowSrc110 ? "YES" : "NO",
      allow_tgt_110: appContext.allowTgt110 ? "YES" : "NO",
      allow_tgt_111: appContext.allowTgt111 ? "YES" : "NO",
      moves_count: appContext.movesCount ?? 0,
      app_version: appContext.appVersion ?? "N/A",
      submitted_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("SUCCEEDED");
        setMessage("");
      } else {
        setStatus("ERROR");
      }
    } catch {
      setStatus("ERROR");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden border border-slate-200 shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3 text-left">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-slate-900">Software Support</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Sends a report to the developer
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {status === "SUCCEEDED" ? (
            <div className="py-8 text-center space-y-3">
              <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} />
              </div>
              <div className="font-bold text-emerald-800 text-lg">Message sent</div>
              <p className="text-sm text-emerald-600 font-medium">Thanks — I'll review this.</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-emerald-400 transition-colors"
              >
                Back to Optimizer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("BUG")}
                  className={`py-2.5 rounded-lg font-semibold text-[10px] border transition-colors flex items-center justify-center gap-2 ${
                    type === "BUG"
                      ? "bg-rose-50 border-rose-400 text-rose-700"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <Bug size={13} /> REPORT A BUG
                </button>
                <button
                  type="button"
                  onClick={() => setType("FEATURE")}
                  className={`py-2.5 rounded-lg font-semibold text-[10px] border transition-colors flex items-center justify-center gap-2 ${
                    type === "FEATURE"
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <Star size={13} /> SUGGEST FEATURE
                </button>
              </div>
              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder={type === "BUG" ? "What went wrong?" : "What should be added or improved?"}
                  className="w-full h-36 p-4 rounded-lg border border-slate-200 bg-slate-50 font-medium text-sm outline-none focus:ring-2 focus:ring-slate-800 transition resize-none text-slate-700 placeholder:text-slate-300"
                />
              </div>
              {status === "ERROR" && (
                <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                  There was an error sending your message. Please try again.
                </p>
              )}
              <button
                type="submit"
                disabled={status === "SUBMITTING" || !message.trim()}
                className="w-full py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-30 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {status === "SUBMITTING" ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send to Developer
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-wider leading-relaxed">
                Included: WH {appContext.warehouse ?? "WH1"} · ABC {appContext.abcThreshold ?? "20"} · Moves{" "}
                {appContext.movesCount ?? 0}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
