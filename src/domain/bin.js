export function normBin(v) {
  return String(v ?? "").trim().toUpperCase();
}

export function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function parseBin(bin) {
  const U = normBin(bin);
  if (!U) return { rowKey: "", num: "", upper: "" };
  const isHH = U.startsWith("HH");
  const isII = U.startsWith("II");
  const rowKey = isHH ? "HH" : isII ? "II" : U[0];
  const numRaw = isHH || isII ? U.slice(2) : U.slice(1);
  const num = String(numRaw || "").padStart(2, "0");
  return { rowKey, num, upper: U };
}

export function getWarehouse(bin) {
  const b = normBin(bin);
  if (!b) return "UNKNOWN";
  if (b.startsWith("3")) return "WH3";
  if (b.includes("R")) return "WH2";
  if (b.startsWith("2A")) return "WH2";
  if ("ABCDEFGHIJ".includes(b[0])) return "WH1";
  return "OTHER";
}

export function inWarehouse(bin, selected) {
  return selected === "ALL" || getWarehouse(bin) === selected;
}
