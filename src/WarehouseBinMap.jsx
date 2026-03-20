import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

const STORAGE_KEY = "warehouseBinInventory";

function loadInventory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveInventory(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function findInventory(storageBin, inventory) {
  return inventory.find(r => r.storage_bin === storageBin) || null;
}

/* =========================================================
   CONSTANTS
   ========================================================= */
const BIN_HEIGHT = 30;
const SIDE_BIN_HEIGHT = 14;
const GAP = 2;
const COLUMN_WIDTH = 68;
const DRIVE_LANE_WIDTH = 24;
const LABEL_HEIGHT = 18;

const TYPE_STYLES = {
  white: { background: "#ffffff", border: "1px solid #555", color: "#111" },
  yellow: { background: "#ffe066", border: "1px solid #b8860b", color: "#333" },
  red: { background: "#e53e3e", border: "1px solid #9b1c1c", color: "#fff" },
  blue: { background: "#3b82f6", border: "1px solid #1d4ed8", color: "#fff" },
};

const COLUMNS_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "HH", "II", "I", "J"];
const DRIVE_LANES_AFTER = ["A", "C", "E", "G", "HH", "I"];

/* =========================================================
   BIN DATA DEFINITIONS
   ========================================================= */
function isAisle(i) {
  return [7, 13, 19, 25, 31, 37, 43].includes(i);
}

const colA = [];
for (let i = 2; i <= 47; i++) {
  const id = `A${String(i).padStart(2, "0")}`;
  const red = isAisle(i);
  colA.push({ id, capacity: red ? 16 : 43, type: red ? "red" : "white", col: "A", row: i });
}

const colBRaw = [
  ["B02", 28, 2], ["B03", 28, 3], ["BS3", 28, 3.1], ["BS4", 28, 3.2], ["BS5", 28, 3.3], ["BS6", 10, 3.4, "red"],
  ["BS7", 28, 3.5], ["B05", 28, 5], ["B06", 28, 6], ["B07", 28, 7], ["B08", 28, 8], ["B09", 28, 9, "red"],
  ["B10", 28, 10], ["B11", 28, 11], ["B12", 28, 12], ["B13", 28, 13], ["B14", 28, 14], ["B15", 10, 15, "red"],
  ["B16", 28, 16], ["B17", 28, 17], ["B18", 28, 18], ["B19", 28, 19], ["B20", 28, 20], ["B21", 10, 21, "red"],
  ["B22", 28, 22], ["B23", 28, 23], ["B24", 28, 24], ["B25", 28, 25], ["B26", 28, 26], ["B27", 10, 27, "red"],
  ["B28", 28, 28], ["B29", 28, 29], ["B30", 28, 30], ["B31", 28, 31], ["B32", 28, 32], ["B33", 10, 33, "red"],
  ["B34", 28, 34], ["B35", 28, 35], ["B36", 28, 36], ["B37", 28, 37], ["B38", 20, 38], ["B39", 8, 39, "red"],
  ["B40", 22, 40], ["B41", 22, 41], ["B42", 8, 42, "red", true],
];
const colB = colBRaw.map(([id, cap, row, forcedType, side]) => ({
  id, capacity: cap, type: forcedType || "white", col: "B", row, ...(side ? { side: true } : {}),
}));

const colCRaw = [
  ["C02", 28, 2], ["C03", 28, 3], ["C04", 28, 4], ["C05", 28, 5], ["C06", 28, 6], ["C07", 10, 7, "red"],
  ["C08", 28, 8], ["C09", 28, 9], ["C10", 28, 10], ["C11", 28, 11], ["C12", 28, 12], ["C13", 10, 13, "red"],
  ["C14", 28, 14], ["C15", 28, 15], ["C16", 28, 16], ["C17", 28, 17], ["C18", 28, 18], ["C19", 10, 19, "red"],
  ["C20", 28, 20], ["C21", 28, 21], ["C22", 28, 22], ["C23", 28, 23], ["C24", 28, 24], ["C25", 10, 25, "red"],
  ["C26", 28, 26], ["C27", 28, 27], ["C28", 28, 28], ["C29", 28, 29], ["C30", 28, 30], ["C31", 10, 31, "red"],
  ["C32", 28, 32], ["C33", 28, 33], ["C34", 28, 34], ["C35", 28, 35], ["C36", 28, 36], ["C37", 10, 37, "red"],
  ["C38", 28, 38], ["C39", 28, 39], ["C40", 28, 40], ["C41", 28, 41], ["C42", 22, 42], ["C43", 8, 43, "red"],
  ["C44", 22, 44], ["C45", 22, 45], ["C46", 22, 46],
];
const colC = colCRaw.map(([id, cap, row, forcedType]) => ({
  id, capacity: cap, type: forcedType || "white", col: "C", row,
}));

const colDRaw = [
  ["D02", 28, 2], ["D03", 28, 3], ["D04", 28, 4], ["D05", 28, 5], ["D06", 28, 6], ["D07", 10, 7, "red"],
  ["D08", 28, 8], ["D09", 28, 9], ["D10", 28, 10], ["D11", 28, 11], ["D12", 28, 12], ["D13", 10, 13, "red"],
  ["D14", 28, 14], ["D15", 28, 15], ["D16", 28, 16], ["D17", 28, 17], ["D18", 28, 18], ["D19", 10, 19, "red"],
  ["D20", 28, 20], ["D21", 28, 21], ["D22", 28, 22], ["D23", 28, 23], ["D24", 28, 24], ["D25", 10, 25, "red"],
  ["D26", 28, 26], ["D27", 28, 27], ["D28", 28, 28], ["D29", 28, 29], ["D30", 28, 30], ["D31", 10, 31, "red"],
  ["D32", 28, 32], ["D33", 28, 33], ["D34", 28, 34], ["D35", 28, 35], ["D36", 28, 36], ["D37", 10, 37, "red"],
  ["D38", 28, 38], ["D39", 28, 39],
];
const colD = colDRaw.map(([id, cap, row, forcedType]) => ({
  id, capacity: cap, type: forcedType || "white", col: "D", row,
}));

const colERaw = [
  ["E02", 22, 2], ["E03", 22, 3], ["E04", 22, 4], ["E05", 22, 5], ["E06", 22, 6], ["E07", 10, 7, "red"],
  ["E08", 22, 8], ["E09", 22, 9], ["E10", 22, 10], ["E11", 22, 11], ["E12", 22, 12], ["E13", 10, 13, "red"],
  ["E14", 22, 14], ["E15", 22, 15], ["E16", 22, 16], ["E17", 22, 17], ["E18", 22, 18], ["E19", 10, 19, "red"],
  ["E20", 22, 20], ["E21", 22, 21], ["E22", 22, 22], ["E23", 22, 23], ["E24", 22, 24], ["E25", 10, 25, "red"],
  ["E26", 22, 26], ["E27", 22, 27], ["E28", 22, 28], ["E29", 21, 29], ["E30", 22, 30], ["E31", 10, 31, "red"],
  ["E32", 22, 32], ["E33", 22, 33], ["E34", 22, 34], ["E35", 22, 35], ["E36", 22, 36], ["E37", 10, 37, "red"],
  ["E38", 22, 38], ["E39", 22, 39],
];
const colE = colERaw.map(([id, cap, row, forcedType]) => ({
  id, capacity: cap, type: forcedType || "white", col: "E", row,
}));

const colF = [];
for (let i = 2; i <= 47; i++) {
  const id = `F${String(i).padStart(2, "0")}`;
  const red = isAisle(i);
  colF.push({ id, capacity: red ? 16 : 40, type: red ? "red" : "white", col: "F", row: i });
}

const colG = [];
for (let i = 2; i <= 47; i++) {
  const id = `G${String(i).padStart(2, "0")}`;
  const red = isAisle(i);
  colG.push({ id, capacity: red ? 10 : 25, type: red ? "red" : "white", col: "G", row: i });
}

const colHRaw = [
  ["H02", 16, 2], ["H03", 16, 3], ["H04", 16, 4],
  ["H05", 16, 5], ["H06", 19, 6], ["H07", 19, 7], ["H08", 16, 8],
  ["H10", 16, 10, "red"], ["H11", 16, 11], ["H12", 16, 12],
  ["H13", 16, 13], ["H14", 16, 14], ["H16", 16, 16],
  ["H17", 16, 17, "red"], ["H18", 19, 18], ["H19", 16, 19], ["H20", 16, 20],
  ["H22", 16, 22], ["H23", 16, 23],
  ["H24", 16, 24, "red"], ["H25", 16, 25], ["H26", 16, 26],
  ["H28", 16, 28], ["H29", 16, 29],
  ["H30", 16, 30], ["H31", 16, 31, "red"], ["H32", 16, 32],
  ["H34", 16, 34], ["H35", 16, 35],
  ["H36", 16, 36], ["H37", 16, 37], ["H38", 16, 38, "red"],
  ["H40", 16, 40], ["H41", 16, 41],
];
const colH = colHRaw.map(([id, cap, row, forcedType]) => ({
  id, capacity: cap, type: forcedType || "white", col: "H", row,
}));

const HM_BINS = [
  { id: "HM01", capacity: 22, type: "white", col: "HM", row: 4.1 },
  { id: "HM02", capacity: 22, type: "white", col: "HM", row: 4.2 },
  { id: "HM03", capacity: 8, type: "red", col: "HM", row: 4.3 },
  { id: "HM04", capacity: 20, type: "white", col: "HM", row: 4.4 },
];

const colHHRaw = [
  ["HH02", 5, 2], ["HH03", 5, 3], ["HH04", 5, 4],
  ["HH05", 5, 5], ["HH06", 5, 6], ["HH07", 2, 7], ["HH08", 5, 8],
  ["HH10", 5, 10, "red"], ["HH11", 4, 11], ["HH12", 5, 12],
  ["HH13", 2, 13], ["HH14", 5, 14], ["HH16", 5, 16],
  ["HH17", 5, 17, "red"], ["HH18", 5, 18], ["HH19", 5, 19], ["HH20", 5, 20],
  ["HH22", 5, 22], ["HH23", 5, 23],
  ["HH24", 5, 24, "red"], ["HH25", 2, 25], ["HH26", 5, 26],
  ["HH28", 4, 28], ["HH29", 4, 29],
  ["HH30", 4, 30], ["HH31", 3, 31, "red"], ["HH32", 4, 32],
  ["HH34", 5, 34], ["HH35", 4, 35],
  ["HH36", 5, 36], ["HH37", 5, 37], ["HH38", 5, 38, "red"],
  ["HH40", 5, 40], ["HH41", 5, 41],
];
const colHH = colHHRaw.map(([id, cap, row, forcedType]) => ({
  id, capacity: cap, type: forcedType || "white", col: "HH", row,
}));

const colII = [];
for (let i = 2; i <= 47; i++) {
  const id = `II${String(i).padStart(2, "0")}`;
  const red = isAisle(i);
  colII.push({ id, capacity: red ? 4 : 10, type: red ? "red" : "white", col: "II", row: i });
}

const specialI = new Set([7, 13, 19, 25, 31, 37, 43]);
const colI = [];
for (let i = 2; i <= 47; i++) {
  const id = `I${String(i).padStart(2, "0")}`;
  const red = specialI.has(i);
  colI.push({ id, capacity: red ? 6 : 13, type: red ? "red" : "white", col: "I", row: i });
}

const colJ = [];
for (let i = 1; i <= 43; i++) {
  const id = `J${String(i).padStart(2, "0")}`;
  colJ.push({ id, capacity: 19, type: "white", col: "J", row: i });
}

const BINS_BY_COL = { A: colA, B: colB, C: colC, D: colD, E: colE, F: colF, G: colG, H: colH, HH: colHH, II: colII, I: colI, J: colJ };

/* =========================================================
   BIN WIDTH OVERRIDES
   ========================================================= */
const BIN_02_WIDTHS = {
  A02: COLUMN_WIDTH * 4 * (43 / 40), B02: COLUMN_WIDTH * 4 * (28 / 40),
  B38: COLUMN_WIDTH * 2, B39: COLUMN_WIDTH * 2, B40: COLUMN_WIDTH * 2, B41: COLUMN_WIDTH * 2, B42: COLUMN_WIDTH * 2,
  C02: COLUMN_WIDTH * 4 * (28 / 40),
  C42: COLUMN_WIDTH * 2, C43: COLUMN_WIDTH * 2, C44: COLUMN_WIDTH * 2, C45: COLUMN_WIDTH * 2, C46: COLUMN_WIDTH * 2,
  D02: COLUMN_WIDTH * 4 * (28 / 40), E02: COLUMN_WIDTH * 4 * (22 / 40), F02: COLUMN_WIDTH * 4,
  G02: COLUMN_WIDTH * 4 * (25 / 40), H02: COLUMN_WIDTH * 4 * (16 / 40), HH02: COLUMN_WIDTH * 4 * (5 / 40),
  II02: COLUMN_WIDTH * 4 * (10 / 40), I02: COLUMN_WIDTH * 4 * (13 / 40), J02: COLUMN_WIDTH * 4 * (19 / 40),
};

const RIGHT_ALIGNED_BINS = new Set(["C42", "C43", "C44", "C45", "C46"]);

/* =========================================================
   LAYOUT HELPERS
   ========================================================= */
function getBinWidth(binId) {
  return BIN_02_WIDTHS[binId] ?? null;
}

function getColWidth(col) {
  const bin02 = (BINS_BY_COL[col] || []).find(b => b.id.endsWith("02"));
  const bin02Width = bin02 ? BIN_02_WIDTHS[bin02.id] : null;
  const defaultWidth = { A: COLUMN_WIDTH * 4, F: COLUMN_WIDTH * 4 }[col] ?? COLUMN_WIDTH;
  return bin02Width && bin02Width > defaultWidth ? bin02Width : defaultWidth;
}

function calcLayout() {
  let x = 0;
  const layout = [];
  for (const col of COLUMNS_ORDER) {
    const w = getColWidth(col);
    layout.push({ col, x, width: w });
    x += w + 2;
    if (DRIVE_LANES_AFTER.includes(col)) x += DRIVE_LANE_WIDTH;
  }
  return { layout, totalWidth: x };
}

function stackBins(bins, startIndex = 0, noSideBins = false) {
  let y = LABEL_HEIGHT + GAP;
  return bins.map((bin, i) => {
    const seqIdx = startIndex + i;
    const isSide = bin.side === true || (!noSideBins && (seqIdx + 1) % 6 === 0);
    const height = isSide ? SIDE_BIN_HEIGHT : BIN_HEIGHT;
    const entry = { bin, y, height };
    y += height + GAP;
    return entry;
  });
}

function buildHMSection(colHBins, colHHBins) {
  const hTop = colHBins.filter(b => parseInt(b.id.replace("H", "")) <= 4);
  const hBottom = colHBins.filter(b => parseInt(b.id.replace("H", "")) >= 5);
  const hhTop = colHHBins.filter(b => parseInt(b.id.replace("HH", "")) <= 4);
  const hhBottom = colHHBins.filter(b => parseInt(b.id.replace("HH", "")) >= 5);

  const jointSequence = [...hTop, ...HM_BINS, ...hBottom];
  const jointPositioned = stackBins(jointSequence, 0);

  const hTopPos = jointPositioned.slice(0, hTop.length);
  const hmPos = jointPositioned.slice(hTop.length, hTop.length + HM_BINS.length);
  const hBottomPos = jointPositioned.slice(hTop.length + HM_BINS.length);

  const hhTopPos = hhTop.map((bin, i) => ({ bin, y: hTopPos[i].y, height: hTopPos[i].height }));

  const hmLastEntry = hmPos[hmPos.length - 1];
  const hhBottomStartY = hmLastEntry.y + hmLastEntry.height + GAP;
  let hhY = hhBottomStartY;
  const hhBottomPos = hhBottom.map((bin, i) => {
    const height = hBottomPos[i] ? hBottomPos[i].height : BIN_HEIGHT;
    const entry = { bin, y: hhY, height };
    hhY += height + GAP;
    return entry;
  });

  return { hTopPos, hmPos, hBottomPos, hhTopPos, hhBottomPos };
}

/* =========================================================
   BIN BOX (inline component)
   ========================================================= */
function BinBox({ bin, x, y, width, height, onClick, selected }) {
  const style = TYPE_STYLES[bin.type] || TYPE_STYLES.white;
  return (
    <div
      onClick={() => onClick(bin)}
      style={{
        position: "absolute", left: x, top: y, width, height,
        ...style, boxSizing: "border-box", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontSize: 7, fontWeight: 600,
        outline: selected ? "2px solid #000" : "none",
        zIndex: selected ? 10 : 1,
        transition: "opacity 0.1s", userSelect: "none", overflow: "hidden",
      }}
    >
      <span style={{ lineHeight: 1.1 }}>{bin.id}</span>
      <span style={{ lineHeight: 1.1, fontWeight: 400, fontSize: 6 }}>{bin.capacity}</span>
    </div>
  );
}

/* =========================================================
   BIN COLUMN (inline component)
   ========================================================= */
function BinColumn({ bins, colLabel, xOffset, colWidth = COLUMN_WIDTH, onBinClick, selectedBin, startIndex = 0, noSideBins = false, rightAlignedBins = new Set() }) {
  const positioned = stackBins(bins, startIndex, noSideBins);
  return (
    <div style={{ position: "absolute", left: xOffset, top: 0, width: colWidth }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: colWidth, height: LABEL_HEIGHT,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 12, background: "#1e293b", color: "#fff", borderRadius: 3, zIndex: 5,
      }}>{colLabel}</div>
      {positioned.map(({ bin, y: binY, height }) => {
        const binWidth = getBinWidth(bin.id) || colWidth;
        const isRightAligned = rightAlignedBins.has(bin.id);
        const binX = isRightAligned ? colWidth - binWidth : 0;
        return (
          <BinBox key={bin.id} bin={bin} x={binX} y={binY} width={binWidth} height={height}
            onClick={onBinClick} selected={selectedBin?.id === bin.id} />
        );
      })}
    </div>
  );
}

/* =========================================================
   STYLED BUTTON HELPERS
   ========================================================= */
const btnBase = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
  cursor: "pointer", border: "1px solid #cbd5e1", background: "#1e293b", color: "#fff",
  transition: "background 0.15s",
};
const btnOutline = {
  ...btnBase,
  background: "#fff", color: "#334155", border: "1px solid #cbd5e1",
};

/* =========================================================
   MAIN COMPONENT
   ========================================================= */
export default function WarehouseBinMap() {
  const [selectedBin, setSelectedBin] = useState(null);
  const [binInventory, setBinInventory] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [inventory, setInventory] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => { setInventory(loadInventory()); }, []);

  const { layout, totalWidth } = calcLayout();
  const CANVAS_HEIGHT = 1400;

  const recordCount = inventory.length;

  /* -- Import handler (local XLSX parsing + localStorage) -- */
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportStatus(null);
    setImportMessage("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const parsed = data
          .map((row) => ({
            storage_bin: row["Storage Bin"] || "",
            material: row["Material"] !== "<<empty>>" ? row["Material"] : "",
            material_description: row["Material Description"] || "",
            available_stock: Number(row["Available stock"]) || 0,
            total_capacity: Number(row["Total capacity"]) || 0,
            remaining_capacity: Number(row["Remaining capacity"]) || 0,
            empty_indicator: row["Empty indicator"] || "",
            base_unit: row["Base Unit of Measure"] || "",
          }))
          .filter((r) => r.storage_bin);

        saveInventory(parsed);
        setInventory(parsed);
        setSelectedBin(null);
        setBinInventory(null);
        setImportStatus("success");
        setImportMessage(`Imported ${parsed.length} bin records to local storage`);
      } catch (error) {
        setImportStatus("error");
        setImportMessage(error.message || "Import failed");
      } finally {
        setImportLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* -- Clear local data -- */
  const handleClearData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setInventory([]);
    setSelectedBin(null);
    setBinInventory(null);
    setImportStatus(null);
  };

  /* -- Bin click handler (localStorage lookup) -- */
  const handleBinClick = (bin) => {
    if (selectedBin?.id === bin.id) {
      setSelectedBin(null);
      setBinInventory(null);
      return;
    }
    setSelectedBin(bin);
    setBinInventory(findInventory(bin.id, inventory));
  };

  /* -- H/HH layout -- */
  const hLayout = layout.find(l => l.col === "H");
  const hhLayout = layout.find(l => l.col === "HH");
  const hmX = hLayout ? hLayout.x : 0;
  const hmWidth = hhLayout ? (hhLayout.x + hhLayout.width - hmX) : COLUMN_WIDTH * 2 + 2;
  const hBinWidth = hhLayout ? (hhLayout.x - hLayout.x) : COLUMN_WIDTH;
  const { hTopPos, hmPos, hBottomPos, hhTopPos, hhBottomPos } = buildHMSection(BINS_BY_COL["H"] || [], BINS_BY_COL["HH"] || []);

  /* -- Prego pallet box lines -- */
  const cLayout = layout.find(l => l.col === "C");
  const cPositioned = stackBins(BINS_BY_COL["C"] || [], 0, false);
  const c42Entry = cPositioned.find(e => e.bin.id === "C42");
  const c46Entry = cPositioned.find(e => e.bin.id === "C46");
  const c42Y = c42Entry ? c42Entry.y : null;
  const c46BottomY = c46Entry ? c46Entry.y + c46Entry.height : null;
  const cLineX = cLayout ? cLayout.x + (cLayout.width - COLUMN_WIDTH * 2) : 0;

  const bLayout = layout.find(l => l.col === "B");
  const bPositioned = stackBins(BINS_BY_COL["B"] || [], 0, false);
  const b38Entry = bPositioned.find(e => e.bin.id === "B38");
  const b38Y = b38Entry ? b38Entry.y : null;
  const b38Width = getBinWidth("B38") || COLUMN_WIDTH;
  const b38RightX = bLayout ? bLayout.x + b38Width : 0;

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16, background: "#f1f5f9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Warehouse Bin Map</h2>

        {/* Import */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={importLoading}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} id="binmap-file-input" />
            <label htmlFor="binmap-file-input">
              <button
                type="button"
                style={{ ...btnBase, opacity: importLoading ? 0.6 : 1, pointerEvents: importLoading ? "none" : "auto" }}
                onClick={() => document.getElementById("binmap-file-input").click()}
              >
                {importLoading ? (<><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing...</>) : (<><Upload size={14} /> Import XLSX</>)}
              </button>
            </label>
          </div>
          {recordCount > 0 && (
            <button type="button" style={btnOutline} onClick={handleClearData}>
              <Trash2 size={14} /> Clear ({recordCount})
            </button>
          )}
          {importStatus && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 6,
              background: importStatus === "success" ? "#dcfce7" : "#fee2e2",
              color: importStatus === "success" ? "#166534" : "#991b1b", fontSize: 12, fontWeight: 500,
            }}>
              {importStatus === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {importMessage}
            </div>
          )}
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1)))}
            style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #cbd5e1", cursor: "pointer", background: "#fff" }}>−</button>
          <span style={{ fontSize: 13, minWidth: 40, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.0, +(s + 0.1).toFixed(1)))}
            style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #cbd5e1", cursor: "pointer", background: "#fff" }}>+</button>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { color: "#fff", border: "#555", label: "Standard" },
            { color: "#e53e3e", border: "#9b1c1c", label: "Side/Special" },
            { color: "#3b82f6", border: "#1d4ed8", label: "HM Special" },
          ].map(({ color, border, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <div style={{ width: 14, height: 14, background: color, border: `1px solid ${border}`, borderRadius: 2 }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Selected bin info */}
      {selectedBin && (
        <div style={{ marginBottom: 10, padding: "12px 16px", background: "#1e293b", color: "#fff", borderRadius: 6, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: binInventory ? 12 : 0 }}>
            <strong style={{ fontSize: 14 }}>{selectedBin.id}</strong>
            <button onClick={() => { setSelectedBin(null); setBinInventory(null); }}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {binInventory ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={{ color: "#cbd5e1" }}>Material:</span> {binInventory.material || "—"}</div>
              <div><span style={{ color: "#cbd5e1" }}>Qty:</span> {binInventory.available_stock}</div>
              <div><span style={{ color: "#cbd5e1" }}>Capacity:</span> {selectedBin.capacity}</div>
              <div><span style={{ color: "#cbd5e1" }}>Remaining:</span> {selectedBin.capacity - (binInventory.available_stock || 0)}</div>
            </div>
          ) : (
            <div style={{ color: "#94a3b8" }}>No inventory data</div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div ref={containerRef} style={{ overflowX: "auto", overflowY: "auto", maxHeight: "80vh", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
        <div style={{ position: "relative", width: totalWidth * scale, height: CANVAS_HEIGHT * scale, transformOrigin: "top left", transform: `scale(${scale})` }}>

          {/* Drive lanes */}
          {DRIVE_LANES_AFTER.map((col) => {
            const colL = layout.find(l => l.col === col);
            if (!colL) return null;
            const laneX = colL.x + (colL.width ?? COLUMN_WIDTH) + 2;
            return (
              <div key={`lane-${col}`} style={{
                position: "absolute", left: laneX, top: 0, width: DRIVE_LANE_WIDTH, height: CANVAS_HEIGHT,
                display: "flex", alignItems: "center", justifyContent: "center", background: "#e2e8f0", zIndex: 0,
              }}>
                <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", fontSize: 8, color: "#64748b", fontWeight: 600, letterSpacing: 1 }}>DRIVE LANE</span>
              </div>
            );
          })}

          {/* Standard columns (not H/HH) */}
          {layout.filter(({ col }) => col !== "H" && col !== "HH").map(({ col, x, width }) => (
            <BinColumn key={col} colLabel={col} bins={BINS_BY_COL[col] || []} xOffset={x} colWidth={width ?? COLUMN_WIDTH}
              onBinClick={handleBinClick} selectedBin={selectedBin} noSideBins={col === "J"} rightAlignedBins={RIGHT_ALIGNED_BINS} />
          ))}

          {/* H column label */}
          {hLayout && (
            <div style={{ position: "absolute", left: hLayout.x, top: 0, width: hBinWidth, height: LABEL_HEIGHT,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: "#1e293b", color: "#fff", borderRadius: 3, zIndex: 5 }}>H</div>
          )}
          {/* HH column label */}
          {hhLayout && (
            <div style={{ position: "absolute", left: hhLayout.x, top: 0, width: COLUMN_WIDTH, height: LABEL_HEIGHT,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: "#1e293b", color: "#fff", borderRadius: 3, zIndex: 5 }}>HH</div>
          )}

          {/* H top bins */}
          {hLayout && hTopPos.map(({ bin, y, height }) => (
            <BinBox key={bin.id} bin={bin} x={hLayout.x} y={y} width={hBinWidth} height={height} onClick={handleBinClick} selected={selectedBin?.id === bin.id} />
          ))}
          {/* HM bins */}
          {hmPos.map(({ bin, y, height }) => (
            <BinBox key={bin.id} bin={bin} x={hmX} y={y} width={hmWidth} height={height} onClick={handleBinClick} selected={selectedBin?.id === bin.id} />
          ))}
          {/* H bottom bins */}
          {hLayout && hBottomPos.map(({ bin, y, height }) => (
            <BinBox key={bin.id} bin={bin} x={hLayout.x} y={y} width={hBinWidth} height={height} onClick={handleBinClick} selected={selectedBin?.id === bin.id} />
          ))}
          {/* HH top bins */}
          {hhLayout && hhTopPos.map(({ bin, y, height }) => (
            <BinBox key={bin.id} bin={bin} x={hhLayout.x} y={y} width={COLUMN_WIDTH} height={height} onClick={handleBinClick} selected={selectedBin?.id === bin.id} />
          ))}
          {/* HH bottom bins */}
          {hhLayout && hhBottomPos.map(({ bin, y, height }) => (
            <BinBox key={bin.id} bin={bin} x={hhLayout.x} y={y} width={COLUMN_WIDTH} height={height} onClick={handleBinClick} selected={selectedBin?.id === bin.id} />
          ))}

          {/* Prego pallet box */}
          {c42Y !== null && c46BottomY !== null && (
            <div style={{ position: "absolute", left: cLineX, top: c42Y, width: 3, height: c46BottomY - c42Y, background: "#1e293b", zIndex: 10 }} />
          )}
          {b38Y !== null && c46BottomY !== null && (
            <div style={{ position: "absolute", left: b38RightX, top: b38Y, width: 3, height: c46BottomY - b38Y, background: "#1e293b", zIndex: 10 }} />
          )}
          {b38Y !== null && cLineX !== null && (
            <div style={{ position: "absolute", left: b38RightX, top: b38Y, width: cLineX - b38RightX, height: 3, background: "#1e293b", zIndex: 10 }} />
          )}
          {c46BottomY !== null && cLineX !== null && (
            <div style={{ position: "absolute", left: b38RightX, top: c46BottomY - 1.5, width: cLineX - b38RightX, height: 3, background: "#1e293b", zIndex: 10 }} />
          )}
          {b38Y !== null && c46BottomY !== null && cLineX !== null && (
            <div style={{ position: "absolute", left: b38RightX, top: b38Y, width: cLineX - b38RightX, height: c46BottomY - b38Y,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#1e293b", zIndex: 5 }}>
              prego pallets
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
