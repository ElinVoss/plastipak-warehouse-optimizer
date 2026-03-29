import React, { useState } from "react";
import { MessageSquare, X, Trash2 } from "lucide-react";
import { MessageList } from "./MessageList";
import { AgentInput } from "./AgentInput";
import { useAgentChat } from "../hooks/useAgentChat";

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const { messages, sendMessage, clearMessages } = useAgentChat();
  const hasMessages = messages.length > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] h-[52px] w-[52px] rounded-full bg-[#1f2933] text-amber-400 shadow-xl hover:bg-[#2d3a45] transition-all flex items-center justify-center border border-stone-600/30"
        aria-label="Open Floor Assistant"
        title="Floor Assistant"
      >
        <MessageSquare size={22} />
        {hasMessages && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-[#1f2933] animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[90] w-96 h-[520px] rounded-[24px] bg-[#ece6da] border border-stone-300/80 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#1f2933] text-stone-100 px-5 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-amber-400/20 flex items-center justify-center">
            <MessageSquare size={15} className="text-amber-400" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">Floor Assistant</div>
            <div className="text-[9px] text-stone-400 font-semibold uppercase tracking-widest">
              Ask about bins, materials &amp; rules
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg hover:bg-white/10 transition text-stone-400 hover:text-stone-100"
              aria-label="Clear messages"
              title="Clear chat"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-stone-400 hover:text-stone-100"
            aria-label="Close"
            title="Minimize"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {/* Gold accent stripe */}
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 shrink-0" />
      {/* Messages */}
      <MessageList messages={messages} />
      {/* Input */}
      <AgentInput onSend={sendMessage} />
    </div>
  );
}
