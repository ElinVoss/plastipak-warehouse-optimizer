import React, { useEffect, useMemo, useRef, useState } from "react";
import logo from "./assets/logo.png";
import WarehouseBinMap from "./features/map/WarehouseBinMap.tsx";
import FeedbackSystem from "./features/support/components/FeedbackSystem";
import SimpleBarChart from "./features/analytics/components/SimpleBarChart";
import BeforeAfterModal from "./features/analytics/components/BeforeAfterModal";
import USER_GUIDE from "./features/guide/userGuide";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { normBin, toNum, parseBin, inWarehouse } from "./domain/bin";
import { baseCapacity } from "./domain/capacity";
import { loadCapOverrides, saveCapOverrides, loadDisabledBins, saveDisabledBins } from "./domain/storage";
import { validateSapHeaders, parseSapExport, buildBinState } from "./domain/sap";
import { calculateAnalytics } from "./domain/analytics";
import { consolidate, findBestBin, moveKey } from "./domain/planning";
import {
  Upload,
  RefreshCcw,
  Download,
  Copy,
  Search,
  Lock,
  Settings2,
  Loader2,
  ArrowRight,
  MessageSquare,
  X,
  Trash2,
  RotateCcw,
  Ban,
} from "lucide-react";

function Eyebrow({ children, className = "" }) {
  return <div className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${className}`}>{children}</div>;
}

function MetricCard({ label, value, tone = "paper" }) {
  const toneClasses = {
    console: "bg-[#1f2933] border-slate-800 text-stone-100 shadow-[0_12px_30px_rgba(31,41,51,0.18)]",
    paper: "bg-[#fcfaf6] border-stone-300 text-slate-900 shadow-[0_10px_24px_rgba(41,37,36,0.05)]",
    danger: "bg-rose-50 border-rose-200 text-rose-900 shadow-[0_10px_24px_rgba(127,29,29,0.08)]",
  };
  const labelClasses = {
    console: "text-stone-300",
    paper: "text-stone-500",
    danger: "text-rose-500",
  };
  return (
    <Card className={`min-w-[92px] p-4 text-center ${toneClasses[tone]}`} variant="paper">
      <div className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${labelClasses[tone]}`}>{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

export default function App() {
  const APP_VERSION = window.wo?.version ?? "2.4.3";
  const mapOnlyMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "map";
  }, []);
  const [xlsxReady, setXlsxReady] = useState(false);
  const xlsxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("xlsx");
        if (!cancelled) { xlsxRef.current = mod; setXlsxReady(true); }
      } catch {
        if (!cancelled) setXlsxReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [supportOpen, setSupportOpen] = useState(false);
  const [rawSapJson, setRawSapJson] = useState(null);
  const [stockRows, setStockRows] = useState([]);
  const [emptyBinsFromExport, setEmptyBinsFromExport] = useState(new Set());
  const [emptyBinTypes, setEmptyBinTypes] = useState({});
  const [moves, setMoves] = useState([]);
  const [freedBins, setFreedBins] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [ignoredMoves, setIgnoredMoves] = useState(new Map());
  const [ignoreModalMove, setIgnoreModalMove] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [initialBinState, setInitialBinState] = useState(null);
  const [finalBinState, setFinalBinState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [activePane, setActivePane] = useState("QUEUE");
  const [searchTerm, setSearchTerm] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [pageSize, setPageSize] = useState(18);
  const [page, setPage] = useState(1);
  const [warehouse, setWarehouse] = useState("WH1");
  const [excludeRbins, setExcludeRbins] = useState(true);
  const [abcThreshold, setAbcThreshold] = useState(20);
  const [phase2Enabled, setPhase2Enabled] = useState(true);
  const [phase2Threshold, setPhase2Threshold] = useState(20);
  const [allowSrc110, setAllowSrc110] = useState(true);
  const [allowTgt110, setAllowTgt110] = useState(true);
  const [allowTgt111, setAllowTgt111] = useState(true);
  const [excludeHISource, setExcludeHISource] = useState(true);
  const CUSTOM_EXCLUDED_BINS = [
    "A07","A13","A19","A25","A31","A37","A43",
    "BS6","B09","B15","B21","B27","B33","B39","B42",
    "C07","C13","C19","C25","C31","C37",
    "D07","D13","D19","D25","D31","D37",
    "E07","E13","E19","E25","E31","E37",
    "F07","F13","F19","F25","F31","F37","F43",
    "G07","G13","G19","G25","G31","G37","G43",
    "HM03","H09","HH09","H15","HH15","H21","HH21","H27","HH27","H33","HH33","H39","HH39",
    "I07","II07","I13","II13","I19","II19","I25","II25","I31","II31","I37","II37","I43","II43",
  ];
  const [excludeCustomBins, setExcludeCustomBins] = useState(true);
  const [showExcludedBinList, setShowExcludedBinList] = useState(false);
  const [lineBins, setLineBins] = useState(Array(17).fill(""));
  const [finderQuery, setFinderQuery] = useState("");
  const [finderQty, setFinderQty] = useState("");
  const [allowABPutaway, setAllowABPutaway] = useState(false);
  const [finderResult, setFinderResult] = useState(null);
  const [capOverrides, setCapOverrides] = useState(() => loadCapOverrides());
  const [disabledBins, setDisabledBins] = useState(() => loadDisabledBins());
  const [binMgmtSearch, setBinMgmtSearch] = useState("");

  const autoDisabledRbinsRef = useRef(new Set());
  const settingsRef = useRef({});

  useEffect(() => {
    settingsRef.current = {
      warehouse, excludeRbins, abcThreshold, phase2Enabled, phase2Threshold,
      allowSrc110, allowTgt110, allowTgt111, excludeHISource, excludeCustomBins, lineBins, capOverrides, disabledBins, ignoredMoves,
    };
  }, [warehouse, excludeRbins, abcThreshold, phase2Enabled, phase2Threshold, allowSrc110, allowTgt110, allowTgt111, excludeHISource, excludeCustomBins, lineBins, capOverrides, disabledBins, ignoredMoves]);

  useEffect(() => { saveCapOverrides(capOverrides); }, [capOverrides]);
  useEffect(() => { saveDisabledBins(disabledBins); }, [disabledBins]);

  const memoizedBinState = useMemo(() => buildBinState(stockRows), [stockRows]);

  useEffect(() => {
    if (stockRows.length === 0) return;
    const binState = memoizedBinState;
    const emptyBins = Array.from(emptyBinsFromExport).map(normBin).filter(Boolean);
    const allBins = new Set([...Object.keys(binState), ...emptyBins]);
    const rBins = Array.from(allBins).filter(b => b.includes("R"));

    if (excludeRbins) {
      // Track which R-bins we auto-disable
      const newAutoDisabled = new Set();
      setDisabledBins(prev => {
        const updated = new Set(prev);
        rBins.forEach(bin => {
          if (!prev.has(bin)) {
            // Only track as auto-disabled if it wasn't already manually disabled
            newAutoDisabled.add(bin);
          }
          updated.add(bin);
        });
        return updated;
      });
      autoDisabledRbinsRef.current = newAutoDisabled;
    } else {
      // Remove only auto-tracked R-bins, preserve manual choices
      setDisabledBins(prev => {
        const updated = new Set(prev);
        autoDisabledRbinsRef.current.forEach(bin => updated.delete(bin));
        return updated;
      });
      autoDisabledRbinsRef.current.clear();
    }
  }, [excludeRbins, stockRows, emptyBinsFromExport]);

  function binInScope(bin, scopeWarehouse, excludeR) {
    const B = normBin(bin);
    if (!B) return false;
    if (excludeR && B.includes("R")) return false;
    return inWarehouse(B, scopeWarehouse);
  }

  function buildPlanFromRaw(jsonRows) {
    setLoadError("");
    setFinderResult(null);
    if (!jsonRows || !Array.isArray(jsonRows)) return;
    const missing = validateSapHeaders(jsonRows);
    if (missing.length) { setLoadError(`Missing columns: ${missing.join(", ")}`); return; }
    const s = settingsRef.current;
    const { stockRows: parsed, emptyBinsFromExport: empties, emptyBinTypes: types } = parseSapExport(jsonRows);
    const filteredStock = parsed.filter((r) => binInScope(r.bin, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(normBin(r.bin)));
    const filteredEmpties = new Set(
      Array.from(empties).map(normBin).filter((b) => binInScope(b, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(b))
    );
    const filteredTypes = {};
    for (const [b, t] of Object.entries(types || {})) {
      const B = normBin(b);
      if (binInScope(B, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(B)) filteredTypes[B] = String(t);
    }
    const lockedSet = new Set((s.lineBins || []).map(normBin).filter(Boolean));
    const initialState = buildBinState(filteredStock);

    const { moves: plan, finalBinState: finalState } = consolidate({
      stockRows: filteredStock,
      emptyBinsSet: filteredEmpties,
      emptyBinTypes: filteredTypes,
      abcThreshold: toNum(s.abcThreshold) || 20,
      phase2Enabled: !!s.phase2Enabled,
      phase2Threshold: toNum(s.phase2Threshold) || 20,
      allowSrc110: !!s.allowSrc110,
      allowTgt110: !!s.allowTgt110,
      allowTgt111: !!s.allowTgt111,
      lockedBins: lockedSet,
      capOverrides: s.capOverrides || {},
      disabledBins: s.disabledBins || new Set(),
      excludeHISource: s.excludeHISource !== false,
      excludedBinSet: s.excludeCustomBins ? new Set(CUSTOM_EXCLUDED_BINS) : new Set(),
      ignoredMoveKeys: new Set(Array.from((s.ignoredMoves || new Map()).keys())),
    });

    const freed = Object.keys(initialState)
      .filter((b) => (initialState[b]?.totalQty || 0) > 0)
      .filter((b) => (finalState[b]?.totalQty || 0) === 0)
      .sort((a, b) => a.localeCompare(b));

    const analyticsData = calculateAnalytics({
      moves: plan, initialBinState: initialState, finalBinState: finalState,
      stockRows: filteredStock, freedBins: freed, capOverrides: s.capOverrides || {},
    });

    setStockRows(filteredStock);
    setEmptyBinsFromExport(filteredEmpties);
    setEmptyBinTypes(filteredTypes);
    setMoves(plan);
    setFreedBins(freed);
    setInitialBinState(initialState);
    setFinalBinState(finalState);
    setAnalytics(analyticsData);
    setShowBeforeAfter(false);
    setCompleted(new Set());
    setPage(1);
  }

  async function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!xlsxReady) { setLoadError("Spreadsheet tools are still loading. Try again in a moment."); return; }
    try {
      const clearedIgnoredMoves = new Map();
      setIgnoredMoves(clearedIgnoredMoves);
      settingsRef.current = { ...settingsRef.current, ignoredMoves: clearedIgnoredMoves };
      const XLSX = xlsxRef.current;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setRawSapJson(json);
      buildPlanFromRaw(json);
      setActivePane("QUEUE");
    } catch (err) {
      const errMsg = err?.message?.toLowerCase() || "";
      if (errMsg.includes("password") || errMsg.includes("encrypted")) {
        setLoadError("File is password-protected. Please remove the password and try again.");
      } else if (errMsg.includes("unsupported") || errMsg.includes("format")) {
        setLoadError("Unsupported file format. Please provide a standard Excel file (XLS/XLSX).");
      } else {
        setLoadError("Could not read the file. Confirm it is a standard SAP export (XLS/XLSX).");
      }
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  function toggleDone(id) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openIgnoreModal(move) {
    setIgnoreModalMove(move);
    setIgnoreReason("");
  }

  function handleIgnoreMove(e) {
    e.preventDefault();
    if (!ignoreModalMove || !rawSapJson) return;
    const ignoredKey = moveKey(ignoreModalMove.materialId, ignoreModalMove.from, ignoreModalMove.to);
    const nextIgnoredMoves = new Map(ignoredMoves);
    nextIgnoredMoves.set(ignoredKey, {
      reason: ignoreReason.trim(),
      timestamp: new Date().toISOString(),
      move: ignoreModalMove,
    });
    setIgnoredMoves(nextIgnoredMoves);
    setIgnoreModalMove(null);
    setIgnoreReason("");
    buildPlanFromRaw(rawSapJson);
  }

  function copyText(t) {
    try { navigator.clipboard?.writeText(String(t)); } catch {}
  }

  async function exportMoves() {
    if (!xlsxReady || !moves.length) return;
    try {
      const XLSX = xlsxRef.current;
      const data = moves.map((m) => ({
        Sequence: m.id,
        "From Bin": m.from,
        "To Bin": m.to,
        Material: m.materialId,
        Description: m.materialDesc,
        Quantity: m.qty,
        Status: completed.has(m.id) ? "DONE" : "PENDING",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consolidation");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Warehouse_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      setLoadError("Export failed. If this persists, try restarting the app.");
    }
  }

  async function exportAnalyticsToExcel() {
    if (!xlsxReady || !analytics) return;
    try {
      const XLSX = xlsxRef.current;
      const summaryData = [
        ["Metric", "Value"],
        ["Total Moves", analytics.totalMoves],
        ["Bins Freed", analytics.totalFreedBins],
        ["Materials Moved", analytics.uniqueMaterialsMoved],
        ["Materials Consolidated", analytics.materialsConsolidated],
        ["Total PAL Moved", analytics.totalPALMoved],
        ["Capacity Utilization Before", `${analytics.capacityUtilizationBefore}%`],
        ["Capacity Utilization After", `${analytics.capacityUtilizationAfter}%`],
        ["Capacity Freed (PAL)", analytics.capacityFreed],
      ];
      const rowKeys = Object.keys({ ...analytics.movesBySourceRow, ...analytics.movesByTargetRow });
      const movesByRowData = [
        ["Row", "Moves From", "Moves To", "PAL Moved"],
        ...rowKeys.sort().map((row) => [row, analytics.movesBySourceRow[row] || 0, analytics.movesByTargetRow[row] || 0, analytics.palMovedByRow[row] || 0]),
      ];
      const topMaterialsData = [
        ["Material ID", "Description", "PAL Moved", "% of Total"],
        ...analytics.topMaterialsByPAL.map((item) => [
          item.materialId, item.materialDesc || "", item.totalPAL,
          analytics.totalPALMoved > 0 ? `${((item.totalPAL / analytics.totalPALMoved) * 100).toFixed(2)}%` : "0%",
        ]),
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(movesByRowData), "Moves by Row");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topMaterialsData), "Top Materials");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Warehouse_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Analytics export failed:", err);
      setLoadError("Analytics export failed. Please try again.");
    }
  }

  async function generatePDFReport() {
    if (!moves.length || !analytics) return;
    const PDF_MOVE_LIMIT = 200;
    const truncated = moves.length > PDF_MOVE_LIMIT;
    const movesToPrint = truncated ? moves.slice(0, PDF_MOVE_LIMIT) : moves;
    if (truncated) {
      console.info(`PDF report: truncated to first ${PDF_MOVE_LIMIT} moves. Use Excel export for full dataset.`);
    }
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const dateStr = new Date().toLocaleString();

      // ── Header ──
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageW, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Warehouse Consolidation Report", pageW / 2, 14, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${dateStr}   |   Warehouse: ${warehouse}   |   v${APP_VERSION}`, pageW / 2, 22, { align: "center" });
      doc.text(`${moves.length} moves  •  ${freedBins.length} bins freed  •  ${analytics.totalPALMoved.toFixed(1)} PAL moved`, pageW / 2, 29, { align: "center" });
      doc.setTextColor(0, 0, 0);

      // ── Summary table ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Summary", margin, 46);

      autoTable(doc, {
        startY: 50,
        margin: { left: margin, right: margin },
        theme: "grid",
        head: [["Metric", "Value"]],
        body: [
          ["Total Moves", moves.length.toString()],
          ["Bins Freed", freedBins.length.toString()],
          ["Freed Bin IDs", freedBins.join(", ") || "None"],
          ["Materials Moved", analytics.uniqueMaterialsMoved.toString()],
          ["Materials Consolidated", analytics.materialsConsolidated.toString()],
          ["Total PAL Moved", analytics.totalPALMoved.toFixed(1)],
          ["Capacity Utilization Before", `${analytics.capacityUtilizationBefore}%`],
          ["Capacity Utilization After", `${analytics.capacityUtilizationAfter}%`],
          ["Capacity Freed", `${analytics.capacityFreed.toFixed(1)} PAL`],
        ],
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
      });

      // ── Freed bins ──
      const afterSummary = doc.lastAutoTable?.finalY ?? 130;

      // ── Move list ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const moveListY = afterSummary + 10;
      doc.text(
        truncated
          ? `Move List (first ${PDF_MOVE_LIMIT} of ${moves.length} — use Excel for full list)`
          : `Move List (${moves.length} moves)`,
        margin,
        moveListY
      );

      autoTable(doc, {
        startY: moveListY + 4,
        margin: { left: margin, right: margin },
        theme: "striped",
        head: [["Seq", "From", "To", "Material", "Description", "PAL", "Status"]],
        body: movesToPrint.map((m) => [
          m.id.toString(),
          m.from,
          m.to,
          m.materialId,
          m.materialDesc ? m.materialDesc.slice(0, 30) : "",
          m.qty.toFixed(1),
          completed.has(m.id) ? "DONE" : "",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 22 },
          4: { cellWidth: "auto" },
          5: { cellWidth: 12, halign: "right" },
          6: { cellWidth: 14, halign: "center" },
        },
      });

      // ── Footer on every page ──
      const pdfPageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pdfPageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Page ${i} of ${pdfPageCount}  |  Warehouse Optimizer v${APP_VERSION}  |  ${dateStr}`,
          pageW / 2,
          pageH - 6,
          { align: "center" }
        );
        // Thin rule above footer
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
      }

      doc.save(`Consolidation_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setLoadError("PDF generation failed. Ensure jspdf and jspdf-autotable are installed.");
    }
  }

  async function exportBinCapacities() {
    if (!xlsxReady || !stockRows.length) return;
    try {
      const XLSX = xlsxRef.current;
      const binSt = memoizedBinState;
      const allBinIds = Array.from(new Set([
        ...Object.keys(binSt),
        ...Array.from(emptyBinsFromExport),
      ])).map(normBin).filter(Boolean).sort((a, b) => a.localeCompare(b));

      const data = allBinIds.map((binId) => {
        const hasOverride = Object.prototype.hasOwnProperty.call(capOverrides, binId);
        const defaultCap = Math.floor(baseCapacity(binId, binSt));
        const effectiveCap = hasOverride ? capOverrides[binId] : defaultCap;
        return { "Bin": binId, "Capacity (PAL)": effectiveCap };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 12 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bin Capacities");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bin_Capacities_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Bin capacity export failed:", err);
      setLoadError("Export failed. Please try again.");
    }
  }

  const filteredMoves = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return moves.filter((m) => {
      if (hideCompleted && completed.has(m.id)) return false;
      if (!q) return true;
      return (
        String(m.materialId || "").toLowerCase().includes(q) ||
        String(m.materialDesc || "").toLowerCase().includes(q) ||
        String(m.from || "").toLowerCase().includes(q) ||
        String(m.to || "").toLowerCase().includes(q)
      );
    });
  }, [moves, completed, searchTerm, hideCompleted]);

  useEffect(() => { setPage(1); }, [searchTerm, hideCompleted]);

  const pageCount = Math.max(1, Math.ceil(filteredMoves.length / Math.max(1, pageSize)));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const visibleMoves = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMoves.slice(start, start + pageSize);
  }, [filteredMoves, page, pageSize]);

  async function openMapInSeparateWindow() {
    try {
      if (window.wo?.openMapWindow) {
        await window.wo.openMapWindow();
      } else {
        setLoadError("Map window is only available in the desktop app build.");
      }
    } catch (err) {
      console.error(err);
      setLoadError("Failed to open separate map window.");
    }
  }

  if (mapOnlyMode) {
    return (
      <div className="min-h-screen bg-slate-100 p-3">
        <div className="mx-auto max-w-[1920px] rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <WarehouseBinMap />
        </div>
      </div>
    );
  }

  if (!xlsxReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-semibold tracking-wide">
          <Loader2 className="animate-spin text-indigo-500" size={20} /> Loading spreadsheet tools…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ece6da] text-slate-900 font-sans">
      <div className="mx-auto max-w-7xl p-3 lg:p-5">
        <div className="overflow-hidden rounded-[28px] border border-stone-300/80 bg-[#fcfaf6] shadow-[0_24px_60px_rgba(41,37,36,0.12)]">
          {/* HEADER */}
          <div className="bg-[#1f2933] text-stone-100">
            <div className="px-6 py-5 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#f0b56a] border border-[#f6cb93] flex items-center justify-center overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                  <img src={logo} alt="Warehouse Optimizer" className="h-8 w-8 object-contain drop-shadow-sm" />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight flex items-center gap-3">
                    Warehouse Optimizer
                    <Badge variant="console" className="text-[11px] tracking-[0.14em] px-2.5 py-1">
                      v{APP_VERSION}
                    </Badge>
                    <div className="hidden lg:flex items-center gap-2 text-stone-300 text-sm">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <span>Floor Use</span>
                    </div>
                  </div>
                  <div className="text-xs text-stone-300 font-medium tracking-[0.18em] mt-1 uppercase">
                    Consolidation Planning and Putaway Decisions
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 text-stone-900 hover:bg-stone-200 px-4 py-2.5 font-semibold text-sm cursor-pointer transition-colors border border-stone-200">
                  <Upload size={16} className="text-amber-700" />
                  <span>Load SAP Export</span>
                  <input type="file" className="hidden" onChange={loadFile} accept=".xlsx,.xls" />
                </label>
                <Button
                  onClick={() => rawSapJson && buildPlanFromRaw(rawSapJson)}
                  disabled={!rawSapJson}
                  variant="console"
                  size="lg"
                  className="border-white/10 bg-[#32404d] hover:bg-[#3a4958]"
                >
                  <RefreshCcw size={16} className="text-stone-200" /> Rebuild Plan
                </Button>
                <Button
                  onClick={exportMoves}
                  disabled={!moves.length}
                  variant="accent"
                  size="lg"
                >
                  <Download size={16} /> Export Moves
                </Button>
                <Button
                  onClick={() => setSupportOpen(true)}
                  variant="ghost-light"
                  size="lg"
                  title="Send a support message"
                >
                  <MessageSquare size={16} className="text-stone-300" /> Support
                </Button>
              </div>
            </div>
            <div className="h-1 w-full bg-[#f0b56a]" />
          </div>

          <div className="grid grid-cols-12">
            {/* SIDE CONTROL PANEL */}
            <aside className="col-span-12 lg:col-span-4 border-r border-stone-300/80 bg-[#f2ece0] p-4 space-y-4">
              {loadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  {loadError}
                </div>
              )}

              <nav className="rounded-2xl border border-stone-300 bg-[#fcfaf6] p-2 shadow-[0_8px_24px_rgba(41,37,36,0.06)]">
                <div className="flex flex-wrap gap-1">
                  {["QUEUE", "PUTAWAY", "BIN MGMT", "ANALYTICS", "MAP", "GUIDE"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setActivePane(p)}
                      className={`relative flex-1 min-w-[60px] py-2.5 px-3 rounded-xl font-semibold text-[11px] tracking-[0.14em] transition-colors ${
                        activePane === p
                          ? "bg-[#1f2933] text-stone-100"
                          : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      }`}
                    >
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </nav>

              {/* Scope & rules */}
              <div className="bg-[#fcfaf6] p-4 rounded-2xl border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[10px] tracking-widest text-slate-400 uppercase">
                  <Settings2 size={13} /> Scope & Rules
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Warehouse Filter</div>
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium"
                  >
                    <option value="WH1">WH1 (A–J, no R)</option>
                    <option value="WH2">WH2 (R-bins / 2A)</option>
                    <option value="WH3">WH3 (3-bins)</option>
                    <option value="ALL">All Areas</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={excludeRbins}
                    onChange={(e) => setExcludeRbins(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <div className="text-xs font-medium leading-tight">
                    Exclude bins with "R"
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">Removes R-locations from scope.</div>
                  </div>
                </label>
              </div>

              {/* Consolidation thresholds */}
              <div className="bg-[#fcfaf6] p-4 rounded-2xl border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[10px] tracking-widest text-slate-400 uppercase">
                  <Settings2 size={13} /> Consolidation
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">ABC Max (PAL)</div>
                    <input
                      value={abcThreshold}
                      onChange={(e) => setAbcThreshold(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-medium"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Phase 2 Max</div>
                    <input
                      value={phase2Threshold}
                      onChange={(e) => setPhase2Threshold(e.target.value)}
                      disabled={!phase2Enabled}
                      className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-medium ${!phase2Enabled ? "opacity-40" : ""}`}
                    />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={phase2Enabled} onChange={(e) => setPhase2Enabled(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    Enable Phase 2
                  </label>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  A/B/C rows are never targets — kept clear for production line putaway.
                </div>
              </div>

              {/* Storage type toggles */}
              <div className="bg-[#fcfaf6] p-4 rounded-2xl border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[10px] tracking-widest text-slate-400 uppercase">
                  <Settings2 size={13} /> Storage Types
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <label className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-50 text-xs font-medium transition-colors">
                    <input type="checkbox" checked={allowSrc110} onChange={(e) => setAllowSrc110(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    Source 110 (allow emptying)
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-50 text-xs font-medium transition-colors">
                    <input type="checkbox" checked={allowTgt110} onChange={(e) => setAllowTgt110(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    Target 110 (allow filling)
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-50 text-xs font-medium transition-colors">
                    <input type="checkbox" checked={allowTgt111} onChange={(e) => setAllowTgt111(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    Target 111 (allow filling)
                  </label>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">111 is never a source. Side bins are never targets.</div>
                <label className="flex items-center gap-3 p-2 rounded-lg bg-amber-50/50 border border-amber-100 cursor-pointer hover:bg-amber-50 text-xs font-medium transition-colors mt-1">
                  <input type="checkbox" checked={excludeHISource} onChange={(e) => setExcludeHISource(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                  <div className="leading-tight">
                    Exclude H/HH/I/II as sources
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">When on, these rows are last-resort targets only.</div>
                  </div>
                </label>
                <div className="mt-1">
                  <label className="flex items-center gap-3 p-2 rounded-lg bg-rose-50/50 border border-rose-100 cursor-pointer hover:bg-rose-50 text-xs font-medium transition-colors">
                    <input type="checkbox" checked={excludeCustomBins} onChange={(e) => setExcludeCustomBins(e.target.checked)} className="rounded border-slate-300 text-rose-600" />
                    <div className="leading-tight">
                      Side Bins ({CUSTOM_EXCLUDED_BINS.length})
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Never used as source or target when on.</div>
                    </div>
                  </label>
                  {excludeCustomBins && (
                    <button
                      onClick={() => setShowExcludedBinList((v) => !v)}
                      className="mt-1 text-[10px] text-rose-500 hover:text-rose-700 font-medium transition-colors ml-2"
                    >
                      {showExcludedBinList ? "▾ Hide list" : "▸ Show list"}
                    </button>
                  )}
                  {excludeCustomBins && showExcludedBinList && (
                    <div className="mt-1 p-2 rounded-lg bg-rose-50 border border-rose-100 text-[9px] font-mono text-rose-700 leading-relaxed max-h-24 overflow-y-auto">
                      {CUSTOM_EXCLUDED_BINS.join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* PROTECTED LINE BINS */}
              <div className="bg-[#fcfaf6] p-4 rounded-2xl border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[10px] tracking-widest text-slate-400 uppercase">
                  <Lock size={13} /> Protected Line Bins
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {lineBins.map((v, i) => (
                    <input
                      key={i}
                      value={v}
                      onChange={(e) => {
                        const n = [...lineBins];
                        n[i] = e.target.value.toUpperCase();
                        setLineBins(n);
                      }}
                      placeholder={`Line ${i + 1}`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-mono text-[10px] font-medium"
                    />
                  ))}
                </div>
              </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="col-span-12 lg:col-span-8 p-5 bg-[#f7f2e8] min-h-[720px]">
              {activePane === "QUEUE" && (
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                    <div className="flex gap-3 flex-wrap">
                      <MetricCard label="Moves" value={moves.length} tone="console" />
                      <MetricCard label="Freed" value={freedBins.length} tone="paper" />
                      {ignoredMoves.size > 0 && (
                        <MetricCard label="Ignored" value={ignoredMoves.size} tone="danger" />
                      )}
                      <Card variant="paper" className="min-w-[280px] grow p-4">
                        <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em] mb-1.5">Freed bins</div>
                        <div className="text-[12px] font-mono text-stone-700 truncate">{freedBins.join(", ") || "—"}</div>
                      </Card>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Filter queue…"
                          variant="paper"
                          className="w-full sm:w-64 pl-9"
                        />
                      </div>
                      <Button
                        onClick={() => setHideCompleted(!hideCompleted)}
                        variant={hideCompleted ? "secondary" : "outline"}
                        className={`text-xs ${
                          hideCompleted ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200" : ""
                        }`}
                      >
                        {hideCompleted ? "Remaining" : "All"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-[11px] font-medium text-stone-500">
                      Showing {filteredMoves.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredMoves.length)} of {filteredMoves.length}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-[#fcfaf6] border border-stone-300 rounded-2xl px-3 py-2 shadow-[0_8px_20px_rgba(41,37,36,0.04)]">
                        <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em]">Rows</div>
                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="bg-transparent text-sm font-medium outline-none">
                          {[12, 18, 24, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-[#fcfaf6] border border-stone-300 rounded-2xl px-3 py-2 shadow-[0_8px_20px_rgba(41,37,36,0.04)]">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-xl font-semibold text-xs border border-stone-300 disabled:opacity-30 hover:bg-stone-100 transition-colors">Prev</button>
                        <div className="text-sm font-semibold tabular-nums">{page} <span className="text-stone-300">/</span> {pageCount}</div>
                        <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="px-3 py-1 rounded-xl font-semibold text-xs border border-stone-300 disabled:opacity-30 hover:bg-stone-100 transition-colors">Next</button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#fcfaf6] rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#ebe3d4] border-b border-stone-300 text-[10px] uppercase font-semibold tracking-[0.18em] text-stone-600 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3.5 font-medium text-stone-700">Status</th>
                            <th className="px-4 py-3.5 text-center font-medium text-stone-700">Seq</th>
                            <th className="px-4 py-3.5 font-medium text-stone-700">Route</th>
                            <th className="px-4 py-3.5 font-medium text-stone-700">Material</th>
                            <th className="px-4 py-3.5 text-right font-medium text-stone-700">PAL</th>
                            <th className="px-4 py-3.5 text-right font-medium text-stone-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 font-medium">
                        {visibleMoves.map((m) => {
                          const done = completed.has(m.id);
                          return (
                            <tr
                              key={m.id}
                              onClick={() => toggleDone(m.id)}
                              className={`cursor-pointer transition-colors hover:bg-[#f3ecdf] ${done ? "opacity-40" : ""}`}
                            >
                              <td className="px-4 py-3.5">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-semibold border ${
                                  done ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                  "bg-stone-100 text-stone-600 border-stone-200"
                                }`}>
                                  {done ? "DONE" : "PENDING"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono text-stone-500 text-xs">{m.id}</td>
                              <td className="px-4 py-3.5 font-mono text-xs">
                                <span className="text-stone-600">{m.from}</span>
                                <ArrowRight className="inline mx-1.5 text-amber-600" size={13} />
                                <span className="text-slate-900 font-semibold">{m.to}</span>
                              </td>
                              <td className="px-4 py-3.5 min-w-[200px]">
                                <div className="text-slate-800 font-semibold">{m.materialId}</div>
                                <div className="text-[10px] text-stone-500 truncate max-w-xs">{m.materialDesc}</div>
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-base font-semibold">{m.qty}</td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); copyText(`${m.from}\t${m.to}\t${m.materialId}\t${m.qty}`); }}
                                    className="inline-flex items-center justify-center p-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
                                    title="Copy row"
                                  >
                                    <Copy size={14} />
                                  </button>
                                  {!done && (
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); openIgnoreModal(m); }}
                                      className="inline-flex items-center justify-center p-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors"
                                      title="Ignore this move and rebuild the plan"
                                    >
                                      <Ban size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!visibleMoves.length && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                              No moves match your filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
              )}

              {activePane === "PUTAWAY" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card variant="paper" className="p-5 space-y-4">
                    <div>
                      <div className="font-bold text-lg text-slate-900">Inbound Finder</div>
                      <Eyebrow className="text-stone-500 mt-1">Putaway Recommendation</Eyebrow>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-semibold text-stone-600 mb-1 uppercase tracking-[0.18em]">Material # or Description</div>
                        <Input
                          value={finderQuery}
                          onChange={(e) => setFinderQuery(e.target.value)}
                          variant="paper"
                          className="font-mono"
                          placeholder="e.g. 100234"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-stone-600 mb-1 uppercase tracking-[0.18em]">Required PAL</div>
                        <Input
                          value={finderQty}
                          onChange={(e) => setFinderQty(e.target.value)}
                          variant="paper"
                          className="font-mono"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-stone-700 rounded-2xl border border-stone-300 bg-[#f5efe4] px-4 py-3">
                        <input type="checkbox" checked={allowABPutaway} onChange={(e) => setAllowABPutaway(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                        Allow A/B/C rows (override production reserve)
                      </label>
                      <Button
                        onClick={() => {
                          const res = findBestBin({
                            query: finderQuery, qtyNeeded: finderQty, stockRows,
                            emptyBinsSet: emptyBinsFromExport, emptyBinTypes,
                            allowAB: allowABPutaway, allowTgt110, allowTgt111, capOverrides,
                          });
                          setFinderResult(res);
                        }}
                        disabled={stockRows.length === 0}
                        variant="console"
                        size="lg"
                        className={`w-full ${stockRows.length ? "" : "bg-stone-200 text-stone-400 shadow-none hover:bg-stone-200"}`}
                      >
                        Search Optimal Bin
                      </Button>
                    </div>
                  </Card>

                  {finderResult && (
                    <Card variant="console" className="p-5 space-y-4">
                      <div>
                        <div className="font-bold text-lg">Results</div>
                        <Eyebrow className="text-stone-400 mt-1">Best Available Bin</Eyebrow>
                      </div>
                      {!finderResult.ok ? (
                        <div className="text-rose-300 font-medium rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">{finderResult.reason}</div>
                      ) : (
                        <div className="space-y-5">
                          <div className="flex items-end justify-between border-b border-white/10 pb-4">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.18em]">Recommended</div>
                              <div className="text-4xl font-bold text-[#f0b56a] font-mono tracking-tight">{finderResult.best.bin}</div>
                              <div className="text-[10px] text-stone-400 font-medium mt-1.5">{finderResult.materialId}</div>
                              <div className="text-xs text-stone-300 truncate">{finderResult.materialDesc}</div>
                            </div>
                            <button onClick={() => copyText(finderResult.best.bin)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 border border-white/10 transition-colors" title="Copy recommended bin">
                              <Copy size={18} />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.18em]">Alternatives</div>
                            {finderResult.top.slice(1, 5).map((c) => (
                              <button key={c.bin} onClick={() => copyText(c.bin)} className="w-full flex justify-between items-center font-mono text-xs p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                <span>{c.bin}</span>
                                <span className="text-stone-400">{c.free} free</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}

              {activePane === "BIN MGMT" && (
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                    <div>
                      <div className="font-bold text-lg text-slate-900">Bin Management</div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 font-semibold mt-1">Capacity and Availability</div>
                      <div className="text-sm font-medium text-stone-700 mt-2">
                        {disabledBins.size > 0 || Object.keys(capOverrides).length > 0 ? (
                          <>{disabledBins.size} disabled {disabledBins.size !== 1 ? "bins" : "bin"} · {Object.keys(capOverrides).length} override{Object.keys(capOverrides).length !== 1 ? "s" : ""}</>
                        ) : "0 disabled · 0 overrides"}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-col sm:flex-row w-full lg:w-auto">
                      <div className="relative flex-1 sm:flex-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                        <input
                          value={binMgmtSearch}
                          onChange={(e) => setBinMgmtSearch(e.target.value)}
                          placeholder="Filter bins…"
                          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-300 bg-[#fcfaf6] text-sm font-medium shadow-[0_8px_20px_rgba(41,37,36,0.04)] sm:w-52 placeholder:text-stone-400"
                        />
                      </div>
                      {(disabledBins.size > 0 || Object.keys(capOverrides).length > 0) && (
                        <button
                          onClick={() => { setDisabledBins(new Set()); setCapOverrides({}); }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs hover:bg-rose-100 transition-colors whitespace-nowrap"
                        >
                          <RotateCcw size={13} /> Reset All
                        </button>
                      )}
                      {stockRows.length > 0 && (
                        <button
                          onClick={exportBinCapacities}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#1f2933] text-stone-100 font-semibold text-xs hover:bg-[#2a3641] transition-colors whitespace-nowrap shadow-[0_12px_24px_rgba(31,41,51,0.18)]"
                        >
                          <Download size={13} /> Export Capacities
                        </button>
                      )}
                    </div>
                  </div>

                  {stockRows.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-center">
                      <div className="font-semibold text-amber-800 mb-1">No SAP data loaded</div>
                      <div className="text-xs text-amber-600 font-medium">Load a SAP export to manage bins.</div>
                    </div>
                  ) : (
                    (() => {
                      const binSt = memoizedBinState;
                      const allBinIds = new Set([...Object.keys(binSt), ...Array.from(emptyBinsFromExport)]);
                      const sorted = Array.from(allBinIds)
                        .map(normBin).filter(Boolean)
                        .filter((b) => !binMgmtSearch || b.toLowerCase().includes(binMgmtSearch.toLowerCase()))
                        .sort((a, b) => a.localeCompare(b));

                      return (
                        <div className="bg-[#fcfaf6] rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-hidden">
                          <div className="max-h-[560px] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-[#ebe3d4] border-b border-stone-300 text-[10px] uppercase font-semibold tracking-[0.18em] text-stone-600 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-center">Enabled</th>
                                  <th className="px-4 py-3">Bin ID</th>
                                  <th className="px-4 py-3">Row</th>
                                  <th className="px-4 py-3 text-right">Stock Qty</th>
                                  <th className="px-4 py-3 text-right">Default Cap</th>
                                  <th className="px-4 py-3 text-right">Custom Cap</th>
                                  <th className="px-4 py-3 text-right">Effective</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-200 font-medium">
                                {sorted.map((binId) => {
                                  const { rowKey } = parseBin(binId);
                                  const stock = binSt[binId]?.totalQty || 0;
                                  const calcCap = baseCapacity(binId, binSt);
                                  const hasOverride = Object.prototype.hasOwnProperty.call(capOverrides, binId);
                                  const isDisabled = disabledBins.has(binId);
                                  const eff = hasOverride ? capOverrides[binId] : calcCap;
                                  const rowClasses = isDisabled ? "opacity-50 bg-rose-50/50" : hasOverride ? "bg-amber-50/50" : "hover:bg-[#f3ecdf]";
                                  return (
                                    <tr key={binId} className={`${rowClasses} transition-colors`}>
                                      <td className="px-4 py-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!isDisabled}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setDisabledBins((prev) => { const next = new Set(prev); next.delete(binId); return next; });
                                              autoDisabledRbinsRef.current.delete(binId);
                                            } else {
                                              setDisabledBins((prev) => new Set(prev).add(binId));
                                            }
                                          }}
                                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                        />
                                      </td>
                                      <td className="px-4 py-2 font-mono text-slate-800 text-xs">{binId}</td>
                                      <td className="px-4 py-2 text-stone-500 text-xs">{rowKey}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{stock}</td>
                                      <td className="px-4 py-2 text-right tabular-nums text-stone-500">{Math.floor(calcCap)}</td>
                                      <td className="px-4 py-2 text-right">
                                        <select
                                          value={hasOverride ? capOverrides[binId] : ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "") {
                                              setCapOverrides((prev) => { const n = { ...prev }; delete n[binId]; return n; });
                                            } else {
                                              const num = parseInt(val, 10);
                                              if (!isNaN(num) && num >= 0) setCapOverrides((prev) => ({ ...prev, [binId]: num }));
                                            }
                                          }}
                                          className="w-20 rounded-xl border border-stone-300 bg-[#f5efe4] px-2 py-1.5 text-right font-mono text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                          <option value="">Default</option>
                                          {Array.from({ length: 44 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                      </td>
                                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${hasOverride ? "text-amber-700" : ""}`}>
                                        {eff}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {activePane === "ANALYTICS" && (
                <div className="space-y-5">
                  {!moves.length || !analytics ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-10 text-center">
                      <div className="font-semibold text-amber-800 mb-1">No consolidation data</div>
                      <div className="text-xs text-amber-600 font-medium">Run a consolidation first to see analytics.</div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-[#1f2933] p-4 rounded-[24px] border border-slate-800 shadow-[0_14px_34px_rgba(31,41,51,0.18)] text-center">
                          <div className="text-[10px] font-semibold text-stone-300 uppercase tracking-[0.18em] mb-1">Total Moves</div>
                          <div className="text-3xl font-bold text-stone-50 tabular-nums">{analytics.totalMoves}</div>
                        </div>
                        <div className="bg-[#fcfaf6] p-4 rounded-[24px] border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] text-center">
                          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em] mb-1">Bins Freed</div>
                          <div className="text-3xl font-bold text-emerald-700 tabular-nums">{analytics.totalFreedBins}</div>
                        </div>
                        <div className="bg-[#fcfaf6] p-4 rounded-[24px] border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] text-center">
                          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em] mb-1">Materials Moved</div>
                          <div className="text-3xl font-bold text-slate-900 tabular-nums">{analytics.uniqueMaterialsMoved}</div>
                        </div>
                        <div className="bg-[#fcfaf6] p-4 rounded-[24px] border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] text-center">
                          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em] mb-1">PAL Moved</div>
                          <div className="text-3xl font-bold text-amber-700 tabular-nums">{analytics.totalPALMoved.toFixed(1)}</div>
                        </div>
                        <div className="bg-[#fcfaf6] p-4 rounded-[24px] border border-stone-300 shadow-[0_10px_24px_rgba(41,37,36,0.05)] text-center">
                          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.18em] mb-1">Consolidated</div>
                          <div className="text-3xl font-bold text-slate-800 tabular-nums">{analytics.materialsConsolidated}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="bg-[#fcfaf6] p-5 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-x-auto">
                          <SimpleBarChart
                            title="Moves by Source Row"
                            data={Object.entries(analytics.movesBySourceRow).sort((a, b) => b[1] - a[1]).map(([row, count]) => ({ label: row, value: count }))}
                            color="#ef4444"
                          />
                        </div>
                        <div className="bg-[#fcfaf6] p-5 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-x-auto">
                          <SimpleBarChart
                            title="Moves by Target Row"
                            data={Object.entries(analytics.movesByTargetRow).sort((a, b) => b[1] - a[1]).map(([row, count]) => ({ label: row, value: count }))}
                            color="#10b981"
                          />
                        </div>
                        <div className="bg-[#fcfaf6] p-5 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)]">
                          <SimpleBarChart
                            title="PAL Moved by Source Row"
                            data={Object.entries(analytics.palMovedByRow).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([row, pal]) => ({ label: row, value: pal }))}
                            color="#f59e0b"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-[#fcfaf6] p-5 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-x-auto">
                          <SimpleBarChart
                            title="PAL Moved by Row"
                            data={Object.entries(analytics.palMovedByRow).sort((a, b) => b[1] - a[1]).map(([row, pal]) => ({ label: row, value: pal }))}
                            color="#8b5cf6"
                          />
                        </div>
                        <div className="bg-[#fcfaf6] p-5 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)]">
                          <div className="font-semibold text-sm text-stone-700 mb-4 uppercase tracking-[0.16em]">Capacity Utilization</div>
                          <div className="space-y-5">
                            <div>
                              <div className="flex justify-between text-xs mb-2">
                                <span className="font-medium">Before Consolidation</span>
                                <span className="font-medium text-stone-500">{analytics.capacityUtilizationBefore}%</span>
                              </div>
                              <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                                <div className="h-full bg-[#1f2933] rounded-full transition-all" style={{ width: `${analytics.capacityUtilizationBefore}%` }} />
                              </div>
                              <div className="text-[10px] text-stone-500 mt-1">
                                {analytics.usedCapacityBefore.toFixed(1)} / {analytics.totalCapacityBefore.toFixed(1)} PAL
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-2">
                                <span className="font-medium">After Consolidation</span>
                                <span className="font-medium text-stone-500">{analytics.capacityUtilizationAfter}%</span>
                              </div>
                              <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                                <div className="h-full bg-[#d97706] rounded-full transition-all" style={{ width: `${analytics.capacityUtilizationAfter}%` }} />
                              </div>
                              <div className="text-[10px] text-stone-500 mt-1">
                                {analytics.usedCapacityAfter.toFixed(1)} / {analytics.totalCapacityAfter.toFixed(1)} PAL
                              </div>
                            </div>
                            <div className="pt-3 border-t border-stone-200">
                              <div className="flex justify-between">
                                <span className="font-semibold text-stone-700 text-sm">Capacity Freed</span>
                                <span className="font-bold text-amber-700">+{analytics.capacityFreed.toFixed(1)} PAL</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#fcfaf6] rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)] overflow-hidden">
                        <div className="p-4 border-b border-stone-200">
                          <div className="font-bold text-base">Top Materials by PAL Moved</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#ebe3d4] border-b border-stone-300 text-[10px] uppercase font-semibold tracking-[0.18em] text-stone-600">
                              <tr>
                                <th className="px-4 py-3 text-left">Material ID</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">PAL Moved</th>
                                <th className="px-4 py-3 text-right">%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 font-medium">
                              {analytics.topMaterialsByPAL.map((item, idx) => (
                                <tr key={idx} className={idx < 3 ? "bg-amber-50/50" : "hover:bg-[#f3ecdf]"}>
                                  <td className="px-4 py-2.5 font-mono text-xs">{item.materialId}</td>
                                  <td className="px-4 py-2.5 text-stone-600 truncate max-w-md">{item.materialDesc || ""}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{item.totalPAL.toFixed(1)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">
                                    {analytics.totalPALMoved > 0 ? ((item.totalPAL / analytics.totalPALMoved) * 100).toFixed(1) : "0.0"}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={exportAnalyticsToExcel}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1f2933] text-stone-100 rounded-2xl font-semibold text-sm hover:bg-[#2a3641] transition-colors shadow-[0_12px_24px_rgba(31,41,51,0.18)]"
                        >
                          <Download size={15} /> Export Analytics
                        </button>
                        <button
                          onClick={generatePDFReport}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#d97706] text-white rounded-2xl font-semibold text-sm hover:bg-[#b85f05] transition-colors shadow-[0_12px_24px_rgba(217,119,6,0.2)]"
                        >
                          <Download size={15} /> PDF Report
                        </button>
                        <button
                          onClick={() => initialBinState && finalBinState && setShowBeforeAfter(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-600 transition-colors shadow-[0_12px_24px_rgba(4,120,87,0.18)]"
                        >
                          <RefreshCcw size={15} /> Before / After
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activePane === "MAP" && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={openMapInSeparateWindow}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#1f2933] text-stone-100 font-semibold text-xs hover:bg-[#2a3641] transition-colors shadow-[0_12px_24px_rgba(31,41,51,0.18)]"
                    >
                      Open in Separate Window
                    </button>
                  </div>
                  <WarehouseBinMap />
                </div>
              )}

              {activePane === "GUIDE" && (
                <div className="bg-[#fcfaf6] p-6 rounded-[24px] border border-stone-300 shadow-[0_14px_34px_rgba(41,37,36,0.07)]">
                  <div className="font-bold text-lg mb-1 text-slate-900">Operations Guide</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 font-semibold mb-4">Reference Notes</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-700">{USER_GUIDE}</pre>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      <div className="text-center py-4 text-slate-400 font-medium text-[10px] uppercase tracking-widest">
        Warehouse Operations Decision Support Engine
      </div>

      <BeforeAfterModal
        isOpen={showBeforeAfter}
        onClose={() => setShowBeforeAfter(false)}
        initialBinState={initialBinState}
        finalBinState={finalBinState}
        freedBins={freedBins}
        parseBin={parseBin}
      />

      {/* Skip reason modal */}
      {ignoreModalMove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIgnoreModalMove(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden border border-white/20 shadow-2xl shadow-slate-900/20">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-pink-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 shadow-lg">
                    <Ban size={24} />
                  </div>
                  <div>
                    <div className="font-bold text-lg tracking-tight text-slate-900">Ignore Move</div>
                    <div className="text-sm text-slate-500 font-medium">Exclude this route and rebuild the plan</div>
                  </div>
                </div>
                <button onClick={() => setIgnoreModalMove(null)} className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-400 hover:text-slate-700" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <form onSubmit={handleIgnoreMove} className="space-y-5">
                <div className="bg-white rounded-xl border border-slate-200/60 p-5 space-y-3 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Move Details</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-slate-400 font-medium mb-1">Material</div>
                      <div className="font-mono font-semibold text-slate-800">{ignoreModalMove.materialId}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-slate-400 font-medium mb-1">Quantity</div>
                      <div className="font-mono font-semibold text-slate-800">{ignoreModalMove.qty} PAL</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                    <div className="text-xs text-slate-400 font-medium mb-2">Route</div>
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                      <span className="font-mono font-medium text-slate-600">{ignoreModalMove.from}</span>
                      <ArrowRight className="text-slate-400 mx-2" size={20} />
                      <span className="font-mono font-medium text-slate-600">{ignoreModalMove.to}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-400 font-medium mb-1">Description</div>
                    <div className="text-sm text-slate-600">{ignoreModalMove.materialDesc}</div>
                  </div>
                </div>
                <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div className="text-sm text-amber-700">
                      This will rebuild the plan from the current SAP snapshot and forbid this exact route for this material. The material can still appear in other moves.
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Reason for ignoring (optional)</label>
                  <textarea
                    value={ignoreReason}
                    onChange={(e) => setIgnoreReason(e.target.value)}
                    placeholder="Optional note, e.g. keep this target row open for production"
                    className="w-full h-28 p-4 rounded-xl border border-slate-200 bg-slate-50 font-medium text-sm outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all resize-none text-slate-700 placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIgnoreModalMove(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:shadow-lg hover:shadow-rose-500/30 transition-all transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Ban size={18} />
                      <span>Ignore Move & Rebuild</span>
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Support modal */}
      <FeedbackSystem
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        appContext={{
          appVersion: APP_VERSION,
          warehouse, excludeRbins, abcThreshold,
          phase2Enabled, phase2Threshold,
          allowSrc110, allowTgt110, allowTgt111,
          movesCount: moves.length,
        }}
      />
    </div>
  );
}
