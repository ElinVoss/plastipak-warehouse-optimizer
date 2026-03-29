import React, { useState } from "react";
import { Send } from "lucide-react";

export function AgentInput({ onSend }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-stone-200 bg-[#f5efe4]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about a bin, material, or rule..."
        className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 outline-none focus:ring-2 focus:ring-amber-400/50 transition placeholder:text-stone-400"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-xl bg-[#1f2933] text-stone-100 p-2.5 hover:bg-[#2d3a45] disabled:opacity-30 transition"
        aria-label="Send"
      >
        <Send size={16} />
      </button>
    </form>
  );
}
