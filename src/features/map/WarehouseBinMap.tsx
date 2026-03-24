import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Search, AlertTriangle, CheckCircle2, Package, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE, APP_VERSION } from "./branding";

type RowKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "HH" | "HM" | "II" | "I" | "J";

type ParsedRecord = {
  sourceRow: number;
  rawBin: string;
  bin: string;
  rowKey: RowKey | "";
  material: string;
  quantity: number;
  storageType: string;
  capacity: number | null;
  isSideBin: boolean;
  isOverflow: boolean;
  notes: string[];
  raw: Record<string, unknown>;
};

type ColumnMap = {
  bin: string | null;
  material: string | null;
  quantity: string | null;
  storageType: string | null;
};

type HeaderInfo = {
  original: string;
  norm: string;
};

type BinItem = {
  material: string;
  quantity: number;
  sourceRows: number[];
};

type BinSummary = {
  bin: string;
  rowKey: RowKey | "";
  capacity: number | null;
  isSideBin: boolean;
  totalQty: number;
  remaining: number | null;
  items: BinItem[];
  records: ParsedRecord[];
  isOverflow: boolean;
  isMapped: boolean;
};

type AlignmentBand = {
  key: string;
  a: string | null;
  b: string | null;
  c: string | null;
  d: string | null;
  e: string | null;
  f: string | null;
  g: string | null;
  h: string | null;
  hm: string | null;
  hh: string | null;
  ii: string | null;
  i: string | null;
  j: string | null;
};

type ConsolidationMove = {
  material: string;
  sourceBin: string;
  targetBin: string;
  moveQty: number;
  sourceIsSideBin: boolean;
  targetRemainingAfter: number;
  notes: string[];
};

const PRIORITY_ROWS = new Set<RowKey>(["A", "B", "C", "D"]);

type WarehouseColumn =
  | { kind: "row"; id: string; title: string; bins: string[]; description?: string }
  | { kind: "lane"; id: string; title: string; description?: string }
  | {
      kind: "hm_pair";
      id: string;
      title: string;
      hBinsBefore: string[];
      hmBins: string[];
      hBinsAfter: string[];
      hhBinsBefore: string[];
      hhBinsAfter: string[];
      description?: string;
    };

const NORMAL_SIDE_SUFFIXES = new Set(["07", "13", "19", "25", "31", "37", "43"]);
const B_SIDE_BINS = new Set(["BS6", "B09", "B15", "B21", "B27", "B33", "B39", "B42"]);
const H_SIDE_BINS = new Set(["HM03", "H09", "H15", "H21", "H27", "H33", "H39", "H43"]);
const HH_SIDE_BINS = new Set(["HM03", "HH09", "HH15", "HH21", "HH27", "HH33", "HH39", "HH43"]);

const REGULAR_CAPACITY: Record<string, number> = {
  A: 43,
  B: 28,
  C: 28,
  D: 28,
  E: 28,
  F: 43,
  G: 25,
  H: 16,
  HH: 5,
  II: 13,
  I: 16,
  J: 19,
};

const SIDE_CAPACITY: Record<string, number> = {
  A: 14,
  B: 10,
  C: 10,
  D: 10,
  E: 10,
  F: 14,
  G: 10,
  H: 4,
  HH: 2,
  II: 4,
  I: 6,
};

const HM_CAPACITY: Record<string, number> = {
  HM01: 22,
  HM02: 22,
  HM03: 6,
  HM04: 22,
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function makeRange(prefix: string, start: number, end: number): string[] {
  const bins: string[] = [];
  for (let n = start; n <= end; n += 1) {
    bins.push(`${prefix}${pad2(n)}`);
  }
  return bins;
}

function buildBRowBins(): string[] {
  return [
    "B02",
    "B03",
    "BS3",
    "BS4",
    "BS5",
    "BS6",
    "BS7",
    "B04",
    "B05",
    ...makeRange("B", 6, 42),
  ];
}

function buildHRowBins(): string[] {
  return makeRange("H", 2, 47);
}

function buildHHRowBins(): string[] {
  return makeRange("HH", 2, 47);
}

function buildJRowBins(): string[] {
  return makeRange("J", 1, 43);
}

const A_ALIGNED = makeRange("A", 2, 47);
const B_ALIGNED = buildBRowBins();
const C_ALIGNED = makeRange("C", 2, 46);
const D_ALIGNED = makeRange("D", 2, 39);
const E_ALIGNED = makeRange("E", 2, 39);
const F_ALIGNED = makeRange("F", 2, 47);
const G_ALIGNED = makeRange("G", 2, 47);
const H_ALIGNED = [...makeRange("H", 2, 4), null, null, null, null, ...makeRange("H", 5, 47)];
const HM_ALIGNED = [null, null, null, "HM01", "HM02", "HM03", "HM04", ...Array(43).fill(null)];
const HH_ALIGNED = [...makeRange("HH", 2, 4), null, null, null, null, ...makeRange("HH", 5, 47)];
const II_ALIGNED = makeRange("II", 2, 47);
const I_ALIGNED = makeRange("I", 2, 47);
const J_PRE_ROW = "J01";
const J_ALIGNED = makeRange("J", 2, 43);

const MAIN_ALIGNMENT_COUNT = Math.max(
  A_ALIGNED.length,
  B_ALIGNED.length,
  C_ALIGNED.length,
  D_ALIGNED.length,
  E_ALIGNED.length,
  F_ALIGNED.length,
  G_ALIGNED.length,
  H_ALIGNED.length,
  HM_ALIGNED.length,
  HH_ALIGNED.length,
  II_ALIGNED.length,
  I_ALIGNED.length,
  J_ALIGNED.length
);

const ALIGNMENT_ROWS: AlignmentBand[] = [
  {
    key: "pre-j01",
    a: null,
    b: null,
    c: null,
    d: null,
    e: null,
    f: null,
    g: null,
    h: null,
    hm: null,
    hh: null,
    ii: null,
    i: null,
    j: J_PRE_ROW,
  },
  ...Array.from({ length: MAIN_ALIGNMENT_COUNT }, (_, index) => ({
    key: `align-${index + 1}`,
    a: A_ALIGNED[index] ?? null,
    b: B_ALIGNED[index] ?? null,
    c: C_ALIGNED[index] ?? null,
    d: D_ALIGNED[index] ?? null,
    e: E_ALIGNED[index] ?? null,
    f: F_ALIGNED[index] ?? null,
    g: G_ALIGNED[index] ?? null,
    h: H_ALIGNED[index] ?? null,
    hm: HM_ALIGNED[index] ?? null,
    hh: HH_ALIGNED[index] ?? null,
    ii: II_ALIGNED[index] ?? null,
    i: I_ALIGNED[index] ?? null,
    j: J_ALIGNED[index] ?? null,
  })),
];

const LAYOUT_BINS = ALIGNMENT_ROWS.flatMap((row) =>
  [row.a, row.b, row.c, row.d, row.e, row.f, row.g, row.h, row.hm, row.hh, row.ii, row.i, row.j].filter(Boolean) as string[]
);
const LAYOUT_BIN_SET = new Set(LAYOUT_BINS);

function normalizeBin(input: unknown): string {
  const raw = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");

  if (!raw) return "";

  const hm = raw.match(/^HM(\d{1,2})$/);
  if (hm) return `HM${hm[1].padStart(2, "0")}`;

  const bs = raw.match(/^BS(\d{1,2})$/);
  if (bs) return `BS${String(Number(bs[1]))}`;

  const hh = raw.match(/^HH(\d{1,2})$/);
  if (hh) return `HH${hh[1].padStart(2, "0")}`;

  const ii = raw.match(/^II(\d{1,2})$/);
  if (ii) return `II${ii[1].padStart(2, "0")}`;

  const single = raw.match(/^([A-J])(\d{1,2}[A-Z]?)$/);
  if (single) {
    const suffix = /^\d+$/.test(single[2]) ? String(Number(single[2])).padStart(2, "0") : single[2];
    return `${single[1]}${suffix}`;
  }

  return raw;
}

function getRowKey(bin: string): RowKey | "" {
  if (!bin) return "";
  if (bin.startsWith("HM")) return "HM";
  if (bin.startsWith("HH")) return "HH";
  if (bin.startsWith("II")) return "II";
  if (bin.startsWith("BS") || bin.startsWith("B")) return "B";
  const one = bin[0];
  if (["A", "C", "D", "E", "F", "G", "H", "I", "J"].includes(one)) return one as RowKey;
  return "";
}

function getSuffix(bin: string): string {
  const match = bin.match(/(\d{2})$/);
  return match ? match[1] : "";
}

function isSideBin(bin: string): boolean {
  const rowKey = getRowKey(bin);
  const suffix = getSuffix(bin);

  if (!rowKey) return false;
  if (rowKey === "HM") return bin === "HM03";
  if (rowKey === "B") return B_SIDE_BINS.has(bin);
  if (rowKey === "H") return H_SIDE_BINS.has(bin);
  if (rowKey === "HH") return HH_SIDE_BINS.has(bin);
  if (rowKey === "J") return false;
  return NORMAL_SIDE_SUFFIXES.has(suffix);
}

function getBinCapacity(bin: string): number | null {
  if (!bin) return null;
  if (bin in HM_CAPACITY) return HM_CAPACITY[bin as keyof typeof HM_CAPACITY];

  const rowKey = getRowKey(bin);
  if (!rowKey || rowKey === "HM") return null;

  if (isSideBin(bin)) {
    return SIDE_CAPACITY[rowKey] ?? null;
  }

  return REGULAR_CAPACITY[rowKey] ?? null;
}

function scoreHeader(
  header: HeaderInfo,
  exact: string[],
  includes: string[],
  excludes: string[] = []
): number {
  if (excludes.some((bad) => header.norm.includes(bad))) return -100;
  if (exact.includes(header.norm)) return 100;

  let score = 0;
  for (const token of includes) {
    if (header.norm.includes(token)) score += 10;
  }

  return score;
}

function pickBestHeader(
  headers: HeaderInfo[],
  exact: string[],
  includes: string[],
  excludes: string[] = []
): string | null {
  const scored = headers
    .map((header) => ({
      original: header.original,
      score: scoreHeader(header, exact, includes, excludes),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.original ?? null;
}

function detectColumns(rows: Record<string, unknown>[]): ColumnMap {
  const headers: HeaderInfo[] = Object.keys(rows[0] || {}).map((h) => ({
    original: h,
    norm: h.toLowerCase().replace(/\s+/g, " ").trim(),
  }));

  return {
    bin: pickBestHeader(
      headers,
      ["storage bin", "bin", "target bin", "to bin", "location"],
      ["storage bin", "location", "bin"],
      ["capacity", "date", "material"]
    ),
    material: pickBestHeader(
      headers,
      ["material", "material number", "item number", "sku", "part", "product"],
      ["material", "item", "sku", "part", "product"],
      ["description", "date", "capacity"]
    ),
    quantity: pickBestHeader(
      headers,
      ["total stock", "available stock", "quantity", "qty", "on hand"],
      ["total stock", "available stock", "quantity", "qty", "on hand", "available", "stock"],
      ["capacity", "block", "date", "inventory", "base unit", "category", "type", "section", "bin", "material"]
    ),
    storageType: pickBestHeader(
      headers,
      ["storage type"],
      ["storage type"],
      ["section", "bin", "material", "capacity"]
    ),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function exportCsv(rows: ParsedRecord[]) {
  const headers = ["Bin", "Row", "Material", "Quantity", "Capacity", "Side Bin", "Overflow", "Notes"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = [
      row.bin,
      row.rowKey,
      row.material,
      row.quantity,
      row.capacity ?? "",
      row.isSideBin ? "YES" : "NO",
      row.isOverflow ? "YES" : "NO",
      row.notes.join(" | "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(values.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse-bin-analysis.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function summarizeBin(records: ParsedRecord[], bin: string, isMapped: boolean): BinSummary {
  const rowKey = getRowKey(bin);
  const capacity = getBinCapacity(bin);
  const itemsMap = new Map<string, BinItem>();
  let totalQty = 0;

  for (const record of records) {
    totalQty += record.quantity;
    const existing = itemsMap.get(record.material);
    if (existing) {
      existing.quantity += record.quantity;
      existing.sourceRows.push(record.sourceRow);
    } else {
      itemsMap.set(record.material, {
        material: record.material,
        quantity: record.quantity,
        sourceRows: [record.sourceRow],
      });
    }
  }

  const items = Array.from(itemsMap.values()).sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.material.localeCompare(b.material);
  });

  return {
    bin,
    rowKey,
    capacity,
    isSideBin: isSideBin(bin),
    totalQty,
    remaining: capacity == null ? null : capacity - totalQty,
    items,
    records,
    isOverflow: capacity != null ? totalQty > capacity : false,
    isMapped,
  };
}

function getSingleMaterial(summary: BinSummary): string | null {
  if (summary.totalQty <= 0) return null;
  if (summary.items.length !== 1) return null;
  return summary.items[0]?.material || null;
}

function getStorageTypes(summary: BinSummary): string[] {
  return Array.from(new Set(summary.records.map((record) => record.storageType).filter(Boolean))).sort();
}

function isType111(summary: BinSummary): boolean {
  return getStorageTypes(summary).includes("111");
}

function getPriorityRowRank(rowKey: RowKey | ""): number {
  return PRIORITY_ROWS.has(rowKey as RowKey) ? 0 : 1;
}

function getFillPercent(summary: BinSummary): number | null {
  if (summary.capacity == null || summary.capacity <= 0) return null;
  return (summary.totalQty / summary.capacity) * 100;
}

function getThresholdRank(summary: BinSummary, thresholdPercent: number | null): number {
  if (thresholdPercent == null) return 0;
  const fillPercent = getFillPercent(summary);
  if (fillPercent == null) return 1;
  return fillPercent <= thresholdPercent ? 0 : 1;
}

function buildConsolidationMoves(
  summaryMap: Map<string, BinSummary>,
  thresholdPercent: number | null,
  allowSideBinSource: boolean
): ConsolidationMove[] {
  const mapped = Array.from(summaryMap.values()).filter((summary) => summary.isMapped);
  const targetRemaining = new Map<string, number>();
  const protectedTargets = new Set<string>();

  for (const summary of mapped) {
    targetRemaining.set(summary.bin, Math.max(summary.remaining ?? 0, 0));
  }

  const sources = mapped
    .filter((summary) => {
      if (summary.totalQty <= 0) return false;
      if (!allowSideBinSource && summary.isSideBin) return false;
      if (isType111(summary)) return false;
      if (!getSingleMaterial(summary)) return false;
      return true;
    })
    .sort((a, b) => {
      const thresholdRankDiff = getThresholdRank(a, thresholdPercent) - getThresholdRank(b, thresholdPercent);
      if (thresholdRankDiff !== 0) return thresholdRankDiff;

      const rowRankDiff = getPriorityRowRank(a.rowKey) - getPriorityRowRank(b.rowKey);
      if (rowRankDiff !== 0) return rowRankDiff;

      if (allowSideBinSource && Number(b.isSideBin) !== Number(a.isSideBin)) return Number(b.isSideBin) - Number(a.isSideBin);
      if (a.totalQty !== b.totalQty) return a.totalQty - b.totalQty;
      return a.bin.localeCompare(b.bin);
    });

  const moves: ConsolidationMove[] = [];

  for (const source of sources) {
    if (protectedTargets.has(source.bin)) continue;

    const material = getSingleMaterial(source);
    if (!material) continue;

    const candidates = mapped
      .filter((target) => {
        if (target.bin === source.bin) return false;
        if (target.totalQty <= 0) return false;
        if (target.isSideBin) return false;
        if (isType111(target)) return false;
        if (getSingleMaterial(target) !== material) return false;
        return (targetRemaining.get(target.bin) ?? 0) >= source.totalQty;
      })
      .sort((a, b) => {
        const targetRowRankDiff = getPriorityRowRank(a.rowKey) - getPriorityRowRank(b.rowKey);
        if (targetRowRankDiff !== 0) return targetRowRankDiff;

        const aAfter = (targetRemaining.get(a.bin) ?? 0) - source.totalQty;
        const bAfter = (targetRemaining.get(b.bin) ?? 0) - source.totalQty;
        if (aAfter !== bAfter) return aAfter - bAfter;
        if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
        return a.bin.localeCompare(b.bin);
      });

    const target = candidates[0];
    if (!target) continue;

    const newRemaining = (targetRemaining.get(target.bin) ?? 0) - source.totalQty;
    targetRemaining.set(target.bin, newRemaining);
    protectedTargets.add(target.bin);

    const notes = [
      "Empties the source bin",
      "Only targets an occupied same-material bin",
      "Never targets a side bin",
      "Excludes storage type 111",
      "Never mixes material",
      "Prefers A/B/C/D rows",
    ];

    const sourceFillPercent = getFillPercent(source);
    if (thresholdPercent != null && sourceFillPercent != null && sourceFillPercent <= thresholdPercent) {
      notes.unshift(`Within fill threshold (${thresholdPercent}% or less)`);
    }

    if (allowSideBinSource && source.isSideBin) {
      notes.unshift("Side-bin sourcing is enabled");
    }

    moves.push({
      material,
      sourceBin: source.bin,
      targetBin: target.bin,
      moveQty: source.totalQty,
      sourceIsSideBin: source.isSideBin,
      targetRemainingAfter: newRemaining,
      notes,
    });
  }

  return moves;
}

function matchesSummary(summary: BinSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    summary.bin,
    summary.rowKey,
    ...summary.items.map((item) => item.material),
    ...summary.records.flatMap((record) => [record.rawBin, record.notes.join(" ")]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function getBinButtonClass(summary: BinSummary, selected: boolean, matched: boolean): string {
  const isHm = summary.bin.startsWith("HM");

  let tone = "border-slate-400 bg-white text-slate-800 hover:bg-slate-50";
  if (isHm) {
    tone = "border-sky-400 bg-sky-100 text-sky-900 hover:bg-sky-100";
  } else if (summary.isSideBin) {
    tone = "border-rose-400 bg-white text-slate-800 hover:bg-rose-50";
  }

  const selectedTone = selected ? " ring-1 ring-slate-900 ring-offset-0" : "";
  const overflowTone = summary.isOverflow ? " shadow-[inset_0_0_0_1px_rgb(239,68,68)]" : "";
  const hiddenTone = matched ? "" : " opacity-25";

  return `h-[22px] w-full rounded-[3px] border px-1 text-center transition ${tone}${selectedTone}${overflowTone}${hiddenTone}`;
}

export default function WarehouseBinMapClickableBSequenceFixed() {
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [columnMap, setColumnMap] = useState<ColumnMap>({ bin: null, material: null, quantity: null, storageType: null });
  const [error, setError] = useState("");
  const [selectedBin, setSelectedBin] = useState<string>("A02");
  const [attackThresholdInput, setAttackThresholdInput] = useState<string>("");
  const [allowSideBinSource, setAllowSideBinSource] = useState<boolean>(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const activeSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[activeSheet];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      if (!rawRows.length) {
        setError("The spreadsheet is empty.");
        setRecords([]);
        return;
      }

      const detected = detectColumns(rawRows);
      setColumnMap(detected);
      setSheetName(activeSheet);

      if (!detected.bin || !detected.material || !detected.quantity) {
        setError("I could not confidently detect Bin, Material, and Quantity columns. Adjust the headers or wire a manual column mapper next.");
      }

      const parsed = rawRows.map((row, index) => {
        const rawBin = detected.bin ? row[detected.bin] : "";
        const material = detected.material ? String(row[detected.material] ?? "").trim() : "";
        const quantity = detected.quantity ? toNumber(row[detected.quantity]) : 0;
        const storageType = detected.storageType ? String(row[detected.storageType] ?? "").trim() : "";
        const bin = normalizeBin(rawBin);
        const rowKey = getRowKey(bin);
        const side = isSideBin(bin);
        const capacity = getBinCapacity(bin);
        const notes: string[] = [];

        if (!bin) notes.push("Missing bin");
        if (!rowKey) notes.push("Unknown bin format");
        if (!material) notes.push("Missing material");
        if (capacity == null && bin) notes.push("No capacity rule found in warehouse map");

        return {
          sourceRow: index + 2,
          rawBin: String(rawBin ?? ""),
          bin,
          rowKey,
          material,
          quantity,
          storageType,
          capacity,
          isSideBin: side,
          isOverflow: capacity != null ? quantity > capacity : false,
          notes,
          raw: row,
        } satisfies ParsedRecord;
      });

      setRecords(parsed);
    } catch (e) {
      console.error(e);
      setError("The file could not be read as a valid .xlsx export.");
      setRecords([]);
    }
  };

  const summaries = useMemo(() => {
    const recordMap = new Map<string, ParsedRecord[]>();
    for (const record of records) {
      if (!record.bin) continue;
      const existing = recordMap.get(record.bin) ?? [];
      existing.push(record);
      recordMap.set(record.bin, existing);
    }

    const summaryMap = new Map<string, BinSummary>();

    for (const bin of LAYOUT_BINS) {
      summaryMap.set(bin, summarizeBin(recordMap.get(bin) ?? [], bin, true));
    }

    for (const [bin, binRecords] of recordMap.entries()) {
      if (!summaryMap.has(bin)) {
        summaryMap.set(bin, summarizeBin(binRecords, bin, false));
      }
    }

    return summaryMap;
  }, [records]);

  const visibleUnknownBins = useMemo(() => {
    return Array.from(summaries.values())
      .filter((summary) => !summary.isMapped)
      .sort((a, b) => a.bin.localeCompare(b.bin));
  }, [summaries]);

  const activeSelectedBin = useMemo(() => {
    if (selectedBin && summaries.has(selectedBin)) return selectedBin;
    const firstOccupied = Array.from(summaries.values()).find((summary) => summary.totalQty > 0 && summary.isMapped);
    return firstOccupied?.bin ?? "A02";
  }, [selectedBin, summaries]);

  const selectedSummary = summaries.get(activeSelectedBin) ?? summarizeBin([], activeSelectedBin, LAYOUT_BIN_SET.has(activeSelectedBin));

  const totals = useMemo(() => {
    const all = Array.from(summaries.values()).filter((summary) => summary.isMapped);
    const occupiedBins = all.filter((summary) => summary.totalQty > 0).length;
    const emptyBins = all.filter((summary) => summary.totalQty === 0).length;
    const overflows = all.filter((summary) => summary.isOverflow).length;
    return { occupiedBins, emptyBins, overflows };
  }, [summaries]);

  const attackThreshold = useMemo(() => {
    const parsed = Number(attackThresholdInput.trim());
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
  }, [attackThresholdInput]);

  const consolidationMoves = useMemo(
    () => buildConsolidationMoves(summaries, attackThreshold, allowSideBinSource),
    [summaries, attackThreshold, allowSideBinSource]
  );

  const GRID_TEMPLATE = "52px 22px 52px 52px 22px 52px 52px 22px 52px 52px 22px 52px 52px 22px 52px 52px 22px 52px";

  const renderBinButton = (bin: string, extraClass = "", span = 1) => {
    const summary = summaries.get(bin) ?? summarizeBin([], bin, true);
    const matched = matchesSummary(summary, search);
    const selected = activeSelectedBin === bin;

    return (
      <button
        key={bin}
        type="button"
        onClick={() => setSelectedBin(bin)}
        style={span > 1 ? { gridColumn: `span ${span} / span ${span}` } : undefined}
        className={`${getBinButtonClass(summary, selected, matched)} ${extraClass}`.trim()}
      >
        <span className="text-[9px] font-semibold leading-none">{bin}</span>
      </button>
    );
  };

  const renderEmptyCell = (key: string, span = 1) => (
    <div
      key={key}
      style={span > 1 ? { gridColumn: `span ${span} / span ${span}` } : undefined}
      className="h-[22px] rounded-[3px] border border-transparent bg-transparent"
    />
  );

  const renderLaneCell = (key: string, showLabel = false) => (
    <div
      key={key}
      className="flex h-[22px] items-center justify-center"
    >
      {showLabel ? <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">LANE</span> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
          <Badge variant="outline">v{APP_VERSION}</Badge>
        </div>
          <div className="text-sm font-medium text-slate-700">{APP_TAGLINE}</div>
          <p className="max-w-4xl text-sm text-slate-600">
            {APP_SUBTITLE}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-slate-400">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-medium">Choose an Excel export</div>
                    <div className="text-sm text-slate-500">
                      Reads the first worksheet, detects Bin / Material / Quantity / Storage Type, and ignores export capacity fields.
                    </div>
                  </div>
                </div>
              </label>
              {error && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Map controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search bin or material" />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Attack bins at or under this fill percentage first</div>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={attackThresholdInput}
                  onChange={(e) => setAttackThresholdInput(e.target.value)}
                  placeholder="Example: 35"
                />
                <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowSideBinSource}
                    onChange={(e) => setAllowSideBinSource(e.target.checked)}
                  />
                  Allow side bins as sources
                </label>
                <div className="text-xs text-slate-500">Enter 0–100. A, B, C, and D rows are always prioritized over other rows.</div>
              </div>
              <div className="text-sm text-slate-600">Each horizontal band is a physical warehouse alignment slot. That makes A02/B02/C02 line up, A04/BS3/C04 line up, and A07/BS6/C07/.../HM03/II07/I07 line up.</div>
              <div className="text-sm text-slate-600">Consolidation only targets occupied same-material regular bins. It never uses empty bins, never uses side bins as targets, and excludes storage type 111 from source and target use.</div>
              <div className="text-sm text-slate-600">Side-bin sourcing is currently {allowSideBinSource ? "enabled" : "disabled"}.</div>
              <div className="text-sm text-slate-600">Source attack order now favors bins at or under your entered fill percentage first, then favors A/B/C/D rows over the rest of the warehouse.</div>
              <Button variant="outline" onClick={() => exportCsv(records)} disabled={!records.length}>
                <Download className="mr-2 h-4 w-4" />
                Export parsed rows
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{records.length}</div><div className="text-sm text-slate-500">Imported rows</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.occupiedBins}</div><div className="text-sm text-slate-500">Occupied bins</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.overflows}</div><div className="text-sm text-slate-500">Overflow bins</div></CardContent></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[2.2fr_1fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Warehouse layout</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200 p-3">
                <div className="min-w-max space-y-1">
                  <div className="grid gap-1" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">A</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">B</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">C</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">D</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">E</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">F</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">G</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">H</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">HH</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">II</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">I</div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-1 py-1 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-800"> </div>
                    <div className="rounded-md border border-slate-500 bg-slate-300 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">J</div>
                  </div>

                  {ALIGNMENT_ROWS.map((row) => {
                    const showCrossLaneLabel = row.a === "A24";

                    return (
                      <div key={row.key} className="grid gap-1" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                        {row.a ? renderBinButton(row.a) : renderEmptyCell(`${row.key}-a`)}
                        {renderLaneCell(`${row.key}-lane-1`, showCrossLaneLabel)}
                        {row.b ? renderBinButton(row.b) : renderEmptyCell(`${row.key}-b`)}
                        {row.c ? renderBinButton(row.c) : renderEmptyCell(`${row.key}-c`)}
                        {renderLaneCell(`${row.key}-lane-2`, showCrossLaneLabel)}
                        {row.d ? renderBinButton(row.d) : renderEmptyCell(`${row.key}-d`)}
                        {row.e ? renderBinButton(row.e) : renderEmptyCell(`${row.key}-e`)}
                        {renderLaneCell(`${row.key}-lane-3`, showCrossLaneLabel)}
                        {row.f ? renderBinButton(row.f) : renderEmptyCell(`${row.key}-f`)}
                        {row.g ? renderBinButton(row.g) : renderEmptyCell(`${row.key}-g`)}
                        {renderLaneCell(`${row.key}-lane-4`, showCrossLaneLabel)}
                        {row.hm ? (
                          renderBinButton(row.hm, "", 2)
                        ) : (
                          <>
                            {row.h ? renderBinButton(row.h) : renderEmptyCell(`${row.key}-h`)}
                            {row.hh ? renderBinButton(row.hh) : renderEmptyCell(`${row.key}-hh`)}
                          </>
                        )}
                        {renderLaneCell(`${row.key}-lane-5`, showCrossLaneLabel)}
                        {row.ii ? renderBinButton(row.ii) : renderEmptyCell(`${row.key}-ii`)}
                        {row.i ? renderBinButton(row.i) : renderEmptyCell(`${row.key}-i`)}
                        {renderLaneCell(`${row.key}-lane-6`, showCrossLaneLabel)}
                        {row.j ? renderBinButton(row.j) : renderEmptyCell(`${row.key}-j`)}
                      </div>
                    );
                  })}

                  <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                    <div style={{ gridColumn: "1 / span 3" }}>
                      <div className="mx-auto w-fit rounded-[3px] border border-slate-600 bg-slate-100 px-4 py-1 text-[9px] font-semibold tracking-wide text-slate-900">
                        PALLETS
                      </div>
                    </div>
                    <div style={{ gridColumn: "8 / span 4" }}>
                      <div className="mx-auto w-fit rounded-[3px] border border-slate-600 bg-slate-100 px-4 py-1 text-[9px] font-semibold tracking-wide text-slate-900">
                        RACKS
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2" style={{ gridColumn: "5 / span 10" }}>
                      {["LINE 1", "LINE 2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map((lineLabel) => (
                        <div
                          key={lineLabel}
                          className="rounded-[3px] border border-slate-400 bg-slate-100 px-2.5 py-1 text-[8px] font-semibold tracking-wide text-slate-700"
                        >
                          {lineLabel}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Selected bin</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-2xl font-semibold tracking-tight">{selectedSummary.bin}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">Row {selectedSummary.rowKey || "—"}</Badge>
                  <Badge variant={selectedSummary.isSideBin ? "secondary" : "outline"}>{selectedSummary.isSideBin ? "Side bin" : "Regular bin"}</Badge>
                  {isType111(selectedSummary) ? <Badge>Type 111</Badge> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Total qty</div><div className="text-lg font-semibold">{selectedSummary.totalQty}</div></div>
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Capacity</div><div className="text-lg font-semibold">{selectedSummary.capacity ?? "—"}</div></div>
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Remaining</div><div className="text-lg font-semibold">{selectedSummary.remaining ?? "—"}</div></div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Material</th><th className="px-3 py-2 font-medium">Qty</th><th className="px-3 py-2 font-medium">Lines</th></tr></thead>
                  <tbody>
                    {selectedSummary.items.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">This bin is empty in the current export.</td></tr>
                    ) : selectedSummary.items.map((item) => (
                      <tr key={`${selectedSummary.bin}-${item.material}`} className="border-t"><td className="px-3 py-2 font-medium">{item.material}</td><td className="px-3 py-2">{item.quantity}</td><td className="px-3 py-2 text-slate-600">{item.sourceRows.join(", ")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Consolidation suggestions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-slate-600">These moves are best-fit same-material consolidations that fully empty a source bin to create new open space for production.</div>
              <div className="text-sm text-slate-600">Side-bin sourcing is {allowSideBinSource ? "enabled" : "disabled"} for the current suggestion set.</div>
              <div className="text-sm text-slate-600">Move order favors bins at or under {attackThreshold ?? "your entered"}% full first when a threshold is set, and prefers A/B/C/D rows for both attack order and target selection.</div>
              {consolidationMoves.length === 0 ? (
                <div className="rounded-xl border bg-white p-3 text-sm text-slate-500">No valid empty-bin-creating moves were found under the current rules.</div>
              ) : (
                consolidationMoves.slice(0, 12).map((move) => (
                  <div key={`${move.sourceBin}-${move.targetBin}-${move.material}`} className="rounded-xl border bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{move.material}</div>
                        <div className="text-slate-600">Move {move.moveQty} from {move.sourceBin} to {move.targetBin}</div>
                      </div>
                      {move.sourceIsSideBin ? <Badge variant="secondary">Side source</Badge> : <Badge variant="outline">Regular source</Badge>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedBin(move.sourceBin)}>Open source</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedBin(move.targetBin)}>Open target</Button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Target remaining after move: {move.targetRemainingAfter}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {move.notes.map((note) => (
                        <Badge key={`${move.sourceBin}-${move.targetBin}-${note}`} variant="outline">{note}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Import details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">File</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{fileName || "No file loaded"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Worksheet</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{sheetName || "—"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Bin column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.bin || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Material column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.material || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Quantity column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.quantity || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Storage Type column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.storageType || "Not detected"}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600">Mapped empty bins currently available: {totals.emptyBins}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Unknown or unmapped bins</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {visibleUnknownBins.length === 0 ? (
                <div className="rounded-xl border bg-white p-3 text-sm text-slate-500">Every detected bin matched the current warehouse layout.</div>
              ) : (
                visibleUnknownBins.slice(0, 20).map((summary) => (
                  <div key={summary.bin} className="rounded-xl border bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{summary.bin}</div>
                      <Badge variant="outline">Qty {summary.totalQty}</Badge>
                    </div>
                    <div className="mt-1 text-slate-600">{summary.items.map((item) => `${item.material} (${item.quantity})`).join(", ") || "No material lines"}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <div>{APP_NAME} v{APP_VERSION}</div>
          <div>Installer-ready desktop build with portable and NSIS targets.</div>
        </div>
      </div>
    </div>
  );
}
