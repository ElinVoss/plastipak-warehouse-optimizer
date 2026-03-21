import { parseBin } from "./bin";

const PAIRS = {
  B: "C",
  C: "B",
  D: "E",
  E: "D",
  F: "G",
  G: "F",
  H: "HH",
  HH: "H",
  I: "II",
  II: "I",
};

export const SIDE_BINS = new Set([
  "B07","B13","B19","B25","B31","B37","B43",
  "C07","C13","C19","C25","C31","C37","C43",
  "D07","D13","D19","D25","D31","D37","D43",
  "E07","E13","E19","E25","E31","E37","E43",
  "F07","F13","F19","F25","F31","F37","F43",
  "G07","G13","G19","G25","G31","G37","G43",
  "H07","H13","H19","H25","H31","H37","H43",
  "HH07","HH13","HH19","HH25","HH31","HH37","HH43",
  "I07","I13","I19","I25","I31","I37","I43",
  "II07","II13","II19","II25","II31","II37","II43"
]);

const PAIR_RULES = {
  B: { tunnelSpanStd: 56, tunnelSpanSB: 20, maxStd: 32, maxSB: 10 },
  C: { tunnelSpanStd: 56, tunnelSpanSB: 20, maxStd: 32, maxSB: 10 },
  D: { tunnelSpanStd: 56, tunnelSpanSB: 20, maxStd: 32, maxSB: 10 },
  E: { tunnelSpanStd: 56, tunnelSpanSB: 20, maxStd: 32, maxSB: 10 },
  F: { tunnelSpanStd: 75, tunnelSpanSB: 75, maxStd: 40, maxSB: 40 },
  G: { tunnelSpanStd: 75, tunnelSpanSB: 75, maxStd: 40, maxSB: 40 },
  I: { tunnelSpanStd: 31, tunnelSpanSB: 12, maxStd: 18, maxSB: 6 },
  II: { tunnelSpanStd: 31, tunnelSpanSB: 12, maxStd: 13, maxSB: 6 },
};

function getPartnerBin(bin) {
  const { rowKey, num } = parseBin(bin);
  if (!rowKey) return null;
  const partnerRow = PAIRS[rowKey];
  return partnerRow ? `${partnerRow}${num}` : null;
}

export function baseCapacity(bin, binState = {}) {
  const { rowKey, upper } = parseBin(bin);
  if (!rowKey) return 0;
  const isSB = SIDE_BINS.has(upper);
  if (rowKey === "A") return isSB ? 16 : 43;
  if (rowKey === "J") return 19;
  if (rowKey === "H" || rowKey === "HH") {
    const partner = getPartnerBin(upper);
    const partnerQty = partner ? binState[partner]?.totalQty || 0 : 0;
    if (isSB) {
      if (rowKey === "H") return partnerQty > 0 ? 6 : 8;
      return partnerQty > 6 ? 0 : 2.5;
    }
    if (rowKey === "H") return partnerQty > 0 ? 13 : 16;
    return partnerQty > 13 ? 0 : 5;
  }
  const rule = PAIR_RULES[rowKey];
  if (rule) {
    const partner = getPartnerBin(upper);
    const partnerQty = partner ? binState[partner]?.totalQty || 0 : 0;
    const tunnelSpan = isSB ? rule.tunnelSpanSB : rule.tunnelSpanStd;
    const individualMax = isSB ? rule.maxSB : rule.maxStd;
    return Math.max(0, Math.min(individualMax, tunnelSpan - partnerQty));
  }
  return 20;
}

export function effectiveCapacity(bin, binState = {}, overrides = {}) {
  const key = String(bin ?? "").trim().toUpperCase();
  if (key && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return baseCapacity(bin, binState);
}
