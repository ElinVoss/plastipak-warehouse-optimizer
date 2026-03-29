import { normBin } from "./bin";

// ─── Master Bin Capacity Roster ──────────────────────────────────────
// Every bin has a FIXED capacity that does NOT change based on partner
// bin occupancy. The app ignores any capacity data from XLSX imports.
// These values are standalone law.

function buildRoster() {
  const m = {};

  function addRow(prefix, start, end, stdCap, sideCap, sidePositions) {
    for (let i = start; i <= end; i++) {
      const num = String(i).padStart(2, "0");
      const binId = `${prefix}${num}`;
      m[binId] = sidePositions.has(num) ? sideCap : stdCap;
    }
  }

  const STD_SIDE = new Set(["07", "13", "19", "25", "31", "37", "43"]);
  const B_SIDE = new Set(["09", "15", "21", "27", "33", "39"]);
  const H_HH_SIDE = new Set(["09", "15", "21", "27", "33", "39"]);

  // A row: 43 standard, 14 side (A02-A47)
  addRow("A", 2, 47, 43, 14, STD_SIDE);

  // B row: 28 standard, 10 side (shifted positions), end bins reduced
  addRow("B", 2, 39, 28, 10, B_SIDE);
  m["B40"] = 22; m["B41"] = 22; m["B42"] = 22; m["B43"] = 8;
  // BS bins (special B-row bins)
  m["BS3"] = 28; m["BS4"] = 28; m["BS5"] = 28; m["BS6"] = 10; m["BS7"] = 28;

  // C row: 28 standard, 10 side, end bins reduced (C02-C46)
  addRow("C", 2, 46, 28, 10, STD_SIDE);
  m["C38"] = 22; m["C39"] = 22; m["C40"] = 22; m["C41"] = 22; m["C42"] = 22; m["C43"] = 8;

  // D row: 28 standard, 10 side (ends at D39)
  addRow("D", 2, 39, 28, 10, STD_SIDE);

  // E row: 28 standard, 10 side (ends at E39)
  addRow("E", 2, 39, 28, 10, STD_SIDE);

  // F row: 40 standard, 14 side (F02-F47)
  addRow("F", 2, 47, 40, 14, STD_SIDE);

  // G row: 25 standard, 10 side (G02-G47)
  addRow("G", 2, 47, 25, 10, STD_SIDE);

  // H row: HM03 occupies the shared H/HH side-bin slot; H side bins resume at 09
  addRow("H", 2, 47, 16, 4, H_HH_SIDE);
  // HM bins (physically in H/HH zone, shared across the H/HH tunnel)
  m["HM01"] = 16; m["HM02"] = 16; m["HM03"] = 4; m["HM04"] = 16;

  // HH row: HM03 occupies the shared H/HH side-bin slot; HH side bins resume at 09
  addRow("HH", 2, 47, 5, 2, H_HH_SIDE);

  // I row: 16 standard, 6 side (I02-I47)
  addRow("I", 2, 47, 16, 6, STD_SIDE);

  // II row: 13 standard, 4 side (II02-II47)
  addRow("II", 2, 47, 13, 4, STD_SIDE);

  // J row: 19 all bins, no side distinction (J01-J43)
  m["J01"] = 19;
  addRow("J", 2, 43, 19, 19, new Set());

  return Object.freeze(m);
}

const BIN_CAPACITY = buildRoster();

export const SIDE_BINS = new Set([
  // A row
  "A07","A13","A19","A25","A31","A37","A43",
  // B row (side positions shifted to 09,15,21,27,33,39)
  "BS6","B09","B15","B21","B27","B33","B39","B42",
  // C row
  "C07","C13","C19","C25","C31","C37","C43",
  // D row (ends at D39)
  "D07","D13","D19","D25","D31","D37",
  // E row (ends at E39)
  "E07","E13","E19","E25","E31","E37",
  // F row
  "F07","F13","F19","F25","F31","F37","F43",
  // G row
  "G07","G13","G19","G25","G31","G37","G43",
  // H / HH shared tunnel: HM03 replaces the H07/HH07 slot, then side bins continue every 6
  "HM03","H09","H15","H21","H27","H33","H39",
  "HH09","HH15","HH21","HH27","HH33","HH39",
  // I row
  "I07","I13","I19","I25","I31","I37","I43",
  // II row
  "II07","II13","II19","II25","II31","II37","II43",
]);

export function baseCapacity(bin) {
  const key = normBin(bin);
  if (!key) return 0;
  if (Object.prototype.hasOwnProperty.call(BIN_CAPACITY, key)) {
    return BIN_CAPACITY[key];
  }
  return 20;
}

export function effectiveCapacity(bin, binState = {}, overrides = {}) {
  const key = normBin(bin);
  if (key && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return baseCapacity(bin);
}
