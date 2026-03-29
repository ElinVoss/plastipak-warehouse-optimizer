import { useState, useCallback, useContext } from "react";
import { classifyIntent } from "../engine/intentEngine";
import { dispatch } from "../engine/handlerRegistry";
import { AgentDataContext } from "../context/AgentDataContext";

let _msgId = 0;

export function useAgentChat() {
  const [messages, setMessages] = useState([]);
  const data = useContext(AgentDataContext);

  const sendMessage = useCallback(
    (rawInput) => {
      const text = String(rawInput || "").trim();
      if (!text) return;

      const userMsg = { id: ++_msgId, role: "user", text };

      const { intent, entities, rawInput: normalized } = classifyIntent(text);
      const context = {
        intent,
        entities,
        rawInput: normalized,
        stockRows: data.stockRows,
        binState: data.binState,
        capOverrides: data.capOverrides,
        disabledBins: data.disabledBins,
        emptyBinsFromExport: data.emptyBinsFromExport,
        emptyBinTypes: data.emptyBinTypes,
        moves: data.moves,
        analytics: data.analytics,
        warehouse: data.warehouse,
      };

      const response = dispatch(intent, context);
      const agentMsg = { id: ++_msgId, role: "agent", ...response };

      setMessages((prev) => [...prev, userMsg, agentMsg]);
    },
    [data]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, clearMessages };
}
