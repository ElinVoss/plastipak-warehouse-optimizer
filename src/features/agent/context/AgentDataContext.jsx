import { createContext } from "react";

export const AgentDataContext = createContext({
  stockRows: [],
  binState: {},
  capOverrides: {},
  disabledBins: new Set(),
  emptyBinsFromExport: new Set(),
  emptyBinTypes: {},
  moves: [],
  analytics: null,
  warehouse: "WH1",
});

export function AgentDataProvider({ value, children }) {
  return (
    <AgentDataContext.Provider value={value}>
      {children}
    </AgentDataContext.Provider>
  );
}
