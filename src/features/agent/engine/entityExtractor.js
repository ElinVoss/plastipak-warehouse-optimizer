import { normBin } from "../../../domain/bin";

// Bin pattern: HH/II prefix, 2A prefix, 3+letter prefix, or single A-J letter, followed by digits
const BIN_RE = /\b(HH|II|2A|3[A-Z]|[A-J])(\d{1,3})\b/gi;

// Row patterns: "row D", "row HH", "D-E", "F/G"
const ROW_SINGLE_RE = /\brow\s+(HH|II|[A-J])\b/gi;
const ROW_PAIR_RE = /\b(HH|II|[A-J])\s*[-\/]\s*(HH|II|[A-J])\b/gi;

// Material IDs: 5-18 digit numbers
const MATERIAL_RE = /\b(\d{5,18})\b/g;

// Warehouse: WH1, WH2, WH3, "warehouse 2", etc.
const WH_RE = /\b(?:WH\s*(\d)|warehouse\s+(\d))\b/gi;

// Quantity: number + optional "pal" or "pallets"
const QTY_RE = /\b(\d+(?:\.\d+)?)\s*(?:pal(?:lets?)?)\b/gi;

export function extractEntities(raw) {
  const input = String(raw || "");
  const result = { bins: [], rows: [], materials: [], warehouse: null, quantity: null };

  let m;
  BIN_RE.lastIndex = 0;
  while ((m = BIN_RE.exec(input)) !== null) {
    const bin = normBin(m[1] + m[2]);
    if (bin && !result.bins.includes(bin)) result.bins.push(bin);
  }

  ROW_PAIR_RE.lastIndex = 0;
  while ((m = ROW_PAIR_RE.exec(input)) !== null) {
    const r1 = m[1].toUpperCase();
    const r2 = m[2].toUpperCase();
    if (!result.rows.includes(r1)) result.rows.push(r1);
    if (!result.rows.includes(r2)) result.rows.push(r2);
  }

  ROW_SINGLE_RE.lastIndex = 0;
  while ((m = ROW_SINGLE_RE.exec(input)) !== null) {
    const r = m[1].toUpperCase();
    if (!result.rows.includes(r)) result.rows.push(r);
  }

  const binDigits = new Set(result.bins.map((b) => b.replace(/^[A-Z]+/i, "")));
  MATERIAL_RE.lastIndex = 0;
  while ((m = MATERIAL_RE.exec(input)) !== null) {
    const id = m[1];
    if (!binDigits.has(id) && !result.materials.includes(id)) {
      result.materials.push(id);
    }
  }

  WH_RE.lastIndex = 0;
  m = WH_RE.exec(input);
  if (m) {
    const num = m[1] || m[2];
    result.warehouse = `WH${num}`;
  }

  QTY_RE.lastIndex = 0;
  m = QTY_RE.exec(input);
  if (m) {
    result.quantity = parseFloat(m[1]);
  }

  return result;
}
