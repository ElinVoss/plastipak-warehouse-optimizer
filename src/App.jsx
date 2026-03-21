import React, { useEffect, useMemo, useRef, useState } from "react";
import logo from "./assets/logo.png";
import WarehouseBinMap from "./features/map/WarehouseBinMap.tsx";
import FeedbackSystem from "./features/support/components/FeedbackSystem";
import SimpleBarChart from "./features/analytics/components/SimpleBarChart";
import BeforeAfterModal from "./features/analytics/components/BeforeAfterModal";
import USER_GUIDE from "./features/guide/userGuide";
import { normBin, toNum, parseBin, inWarehouse } from "./domain/bin";
import { baseCapacity } from "./domain/capacity";
import { loadCapOverrides, saveCapOverrides, loadDisabledBins, saveDisabledBins } from "./domain/storage";
import { validateSapHeaders, parseSapExport, buildBinState } from "./domain/sap";
import { calculateAnalytics } from "./domain/analytics";
import { consolidate, findBestBin } from "./domain/planning";
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
  CheckCircle,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Ban,
} from "lucide-react";


export default function App() {
  const APP_VERSION = window.wo?.version ?? "2.4.3";
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
  const [skipped, setSkipped] = useState(new Map());
  const [skipModalMove, setSkipModalMove] = useState(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipSubmitStatus, setSkipSubmitStatus] = useState("IDLE");
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
      allowSrc110, allowTgt110, allowTgt111, excludeHISource, excludeCustomBins, lineBins, capOverrides, disabledBins,
    };
  }, [warehouse, excludeRbins, abcThreshold, phase2Enabled, phase2Threshold, allowSrc110, allowTgt110, allowTgt111, excludeHISource, excludeCustomBins, lineBins, capOverrides, disabledBins]);

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
    setSkipped(new Map());
    setPage(1);
  }

  async function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!xlsxReady) { setLoadError("Spreadsheet tools are still loading. Try again in a moment."); return; }
    try {
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
    if (skipped.has(id)) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openSkipModal(move) {
    setSkipModalMove(move);
    setSkipReason("");
    setSkipSubmitStatus("IDLE");
  }

  async function handleSkipSubmit(e) {
    e.preventDefault();
    if (!skipModalMove || !skipReason.trim()) return;
    setSkipSubmitStatus("SUBMITTING");
    const payload = {
      report_type: "MOVE_NOT_DOABLE",
      move_id: skipModalMove.id,
      from_bin: skipModalMove.from,
      to_bin: skipModalMove.to,
      material: skipModalMove.materialId,
      material_desc: skipModalMove.materialDesc || "",
      quantity: skipModalMove.qty,
      warehouse,
      reason: skipReason.trim(),
      timestamp: new Date().toISOString(),
      app_version: APP_VERSION,
    };
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSkipped((prev) => {
          const next = new Map(prev);
          next.set(skipModalMove.id, { reason: skipReason.trim(), timestamp: new Date().toISOString() });
          return next;
        });
        setSkipSubmitStatus("SUCCEEDED");
        setTimeout(() => setSkipModalMove(null), 1200);
      } else {
        setSkipSubmitStatus("ERROR");
      }
    } catch {
      setSkipSubmitStatus("ERROR");
    }
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
        Status: skipped.has(m.id) ? "SKIPPED" : completed.has(m.id) ? "DONE" : "PENDING",
        "Skip Reason": skipped.has(m.id) ? skipped.get(m.id).reason : "",
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
          skipped.has(m.id) ? "SKIP" : completed.has(m.id) ? "DONE" : "",
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
      if (hideCompleted && skipped.has(m.id)) return false;
      if (!q) return true;
      return (
        String(m.materialId || "").toLowerCase().includes(q) ||
        String(m.materialDesc || "").toLowerCase().includes(q) ||
        String(m.from || "").toLowerCase().includes(q) ||
        String(m.to || "").toLowerCase().includes(q)
      );
    });
  }, [moves, completed, skipped, searchTerm, hideCompleted]);

  useEffect(() => { setPage(1); }, [searchTerm, hideCompleted]);

  const pageCount = Math.max(1, Math.ceil(filteredMoves.length / Math.max(1, pageSize)));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const visibleMoves = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMoves.slice(start, start + pageSize);
  }, [filteredMoves, page, pageSize]);

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
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="mx-auto max-w-7xl p-3 lg:p-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
            <div className="px-5 py-3.5 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur">
                  <img src={logo} alt="Warehouse Optimizer" className="h-7 w-7 object-contain" />
                </div>
                <div>
                  <div className="text-lg font-bold tracking-tight flex items-center gap-2">
                    Warehouse Optimizer
                    <span className="text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 px-1.5 py-0.5 rounded-md tracking-wide">v{APP_VERSION}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                    Tunnel-aware consolidation & putaway
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 font-semibold text-xs cursor-pointer transition-colors shadow-sm">
                  <Upload size={14} /> Load SAP
                  <input type="file" className="hidden" onChange={loadFile} accept=".xlsx,.xls" />
                </label>
                <button
                  onClick={() => rawSapJson && buildPlanFromRaw(rawSapJson)}
                  disabled={!rawSapJson}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 px-3.5 py-2 font-semibold text-xs border border-white/10 disabled:opacity-30 transition-colors"
                >
                  <RefreshCcw size={14} /> Rebuild
                </button>
                <button
                  onClick={exportMoves}
                  disabled={!moves.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-3.5 py-2 font-semibold text-xs disabled:opacity-30 transition-colors shadow-sm"
                >
                  <Download size={14} /> Export
                </button>
                <button
                  onClick={() => setSupportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-3.5 py-2 font-semibold text-xs border border-white/10 transition-colors"
                  title="Send a support message"
                >
                  <MessageSquare size={14} /> Support
                </button>
              </div>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
          </div>

          <div className="grid grid-cols-12">
            {/* SIDE CONTROL PANEL */}
            <aside className="col-span-12 lg:col-span-4 border-r border-slate-200/60 bg-slate-50/80 p-4 space-y-4">
              {loadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  {loadError}
                </div>
              )}

              <nav className="flex flex-wrap gap-1 bg-white p-1.5 rounded-xl border border-slate-200/60 shadow-sm">
                {["QUEUE", "PUTAWAY", "BIN MGMT", "ANALYTICS", "MAP", "GUIDE"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePane(p)}
                    className={`flex-1 min-w-[60px] py-2 rounded-lg font-semibold text-[10px] tracking-wide transition-all ${
                      activePane === p
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </nav>

              {/* Scope & rules */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
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
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
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
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
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
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
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
            <main className="col-span-12 lg:col-span-8 p-5 bg-slate-50/50 min-h-[720px]">
              {activePane === "QUEUE" && (
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                    <div className="flex gap-3 flex-wrap">
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm text-center min-w-[80px]">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Moves</div>
                        <div className="text-2xl font-bold tabular-nums">{moves.length}</div>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm text-center min-w-[80px]">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Freed</div>
                        <div className="text-2xl font-bold text-emerald-600 tabular-nums">{freedBins.length}</div>
                      </div>
                      {skipped.size > 0 && (
                        <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 shadow-sm text-center min-w-[80px]">
                          <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide">Skipped</div>
                          <div className="text-2xl font-bold text-rose-600 tabular-nums">{skipped.size}</div>
                        </div>
                      )}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm min-w-[240px] grow">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Freed bins</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">{freedBins.join(", ") || "—"}</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                        <input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Filter queue…"
                          className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium shadow-sm placeholder:text-slate-300"
                        />
                      </div>
                      <button
                        onClick={() => setHideCompleted(!hideCompleted)}
                        className={`px-3.5 py-2 rounded-lg font-semibold text-xs border transition-colors shadow-sm ${
                          hideCompleted ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white border-slate-200 text-slate-500"
                        }`}
                      >
                        {hideCompleted ? "Remaining" : "All"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-[11px] font-medium text-slate-400">
                      Showing {filteredMoves.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredMoves.length)} of {filteredMoves.length}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase">Rows</div>
                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="bg-transparent text-sm font-medium outline-none">
                          {[12, 18, 24, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2.5 py-1 rounded-md font-semibold text-xs border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors">Prev</button>
                        <div className="text-sm font-semibold tabular-nums">{page} <span className="text-slate-300">/</span> {pageCount}</div>
                        <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="px-2.5 py-1 rounded-md font-semibold text-xs border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors">Next</button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-center">Seq</th>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3">Material</th>
                          <th className="px-4 py-3 text-right">PAL</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {visibleMoves.map((m) => {
                          const done = completed.has(m.id);
                          const isSkipped = skipped.has(m.id);
                          const skipInfo = isSkipped ? skipped.get(m.id) : null;
                          return (
                            <tr
                              key={m.id}
                              onClick={() => toggleDone(m.id)}
                              className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSkipped ? "bg-rose-50/50 opacity-50" : done ? "opacity-35" : ""}`}
                            >
                              <td className="px-4 py-3.5">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-semibold border ${
                                  isSkipped ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  done ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  "bg-slate-50 text-slate-400 border-slate-200"
                                }`}>
                                  {isSkipped ? "SKIPPED" : done ? "DONE" : "PENDING"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono text-slate-400 text-xs">{m.id}</td>
                              <td className="px-4 py-3.5 font-mono text-xs">
                                <span className="text-slate-500">{m.from}</span>
                                <ArrowRight className="inline mx-1.5 text-indigo-400" size={13} />
                                <span className="text-indigo-600 font-semibold">{m.to}</span>
                              </td>
                              <td className="px-4 py-3.5 min-w-[200px]">
                                <div className="text-slate-800 font-semibold">{m.materialId}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-xs">{m.materialDesc}</div>
                                {skipInfo && (
                                  <div className="text-[10px] text-rose-600 font-semibold mt-1 truncate max-w-xs">
                                    <AlertTriangle className="inline mr-1" size={10} />
                                    {skipInfo.reason}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-base font-semibold">{m.qty}</td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); copyText(`${m.from}\t${m.to}\t${m.materialId}\t${m.qty}`); }}
                                    className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Copy row"
                                  >
                                    <Copy size={14} />
                                  </button>
                                  {!done && !isSkipped && (
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); openSkipModal(m); }}
                                      className="inline-flex items-center justify-center p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors"
                                      title="Can't do this move"
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
              )}

              {activePane === "PUTAWAY" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="font-bold text-base">Inbound Finder</div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Material # or Description</div>
                        <input
                          value={finderQuery}
                          onChange={(e) => setFinderQuery(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm font-medium placeholder:text-slate-300"
                          placeholder="e.g. 100234"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Required PAL</div>
                        <input
                          value={finderQty}
                          onChange={(e) => setFinderQty(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm font-medium"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={allowABPutaway} onChange={(e) => setAllowABPutaway(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                        Allow A/B/C rows (override production reserve)
                      </label>
                      <button
                        onClick={() => {
                          const res = findBestBin({
                            query: finderQuery, qtyNeeded: finderQty, stockRows,
                            emptyBinsSet: emptyBinsFromExport, emptyBinTypes,
                            allowAB: allowABPutaway, allowTgt110, allowTgt111, capOverrides,
                          });
                          setFinderResult(res);
                        }}
                        disabled={stockRows.length === 0}
                        className={`w-full font-semibold py-2.5 rounded-lg transition-colors ${
                          stockRows.length ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        Search Optimal Bin
                      </button>
                    </div>
                  </div>

                  {finderResult && (
                    <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg space-y-4">
                      <div className="font-bold text-base">Results</div>
                      {!finderResult.ok ? (
                        <div className="text-rose-300 font-medium">{finderResult.reason}</div>
                      ) : (
                        <div className="space-y-5">
                          <div className="flex items-end justify-between border-b border-white/10 pb-4">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Recommended</div>
                              <div className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">{finderResult.best.bin}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-1.5">{finderResult.materialId}</div>
                              <div className="text-xs text-slate-300 truncate">{finderResult.materialDesc}</div>
                            </div>
                            <button onClick={() => copyText(finderResult.best.bin)} className="p-2.5 bg-white/5 rounded-lg hover:bg-white/10 border border-white/10 transition-colors" title="Copy recommended bin">
                              <Copy size={18} />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Alternatives</div>
                            {finderResult.top.slice(1, 5).map((c) => (
                              <button key={c.bin} onClick={() => copyText(c.bin)} className="w-full flex justify-between items-center font-mono text-xs p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span>{c.bin}</span>
                                <span className="text-slate-400">{c.free} free</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activePane === "BIN MGMT" && (
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                    <div>
                      <div className="font-bold text-base">Bin Management</div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">Enable/disable bins and manage custom capacities.</div>
                      <div className="text-sm font-medium text-slate-600 mt-1.5">
                        {disabledBins.size > 0 || Object.keys(capOverrides).length > 0 ? (
                          <>{disabledBins.size} disabled {disabledBins.size !== 1 ? "bins" : "bin"} · {Object.keys(capOverrides).length} override{Object.keys(capOverrides).length !== 1 ? "s" : ""}</>
                        ) : "0 disabled · 0 overrides"}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-col sm:flex-row w-full lg:w-auto">
                      <div className="relative flex-1 sm:flex-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                        <input
                          value={binMgmtSearch}
                          onChange={(e) => setBinMgmtSearch(e.target.value)}
                          placeholder="Filter bins…"
                          className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium shadow-sm sm:w-52 placeholder:text-slate-300"
                        />
                      </div>
                      {(disabledBins.size > 0 || Object.keys(capOverrides).length > 0) && (
                        <button
                          onClick={() => { setDisabledBins(new Set()); setCapOverrides({}); }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs hover:bg-rose-100 transition-colors whitespace-nowrap"
                        >
                          <RotateCcw size={13} /> Reset All
                        </button>
                      )}
                      {stockRows.length > 0 && (
                        <button
                          onClick={exportBinCapacities}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-500 text-white font-semibold text-xs hover:bg-indigo-400 transition-colors whitespace-nowrap shadow-sm"
                        >
                          <Download size={13} /> Export Capacities
                        </button>
                      )}
                    </div>
                  </div>

                  {stockRows.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
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
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                          <div className="max-h-[560px] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold tracking-wider text-slate-400 sticky top-0 z-10">
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
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {sorted.map((binId) => {
                                  const { rowKey } = parseBin(binId);
                                  const stock = binSt[binId]?.totalQty || 0;
                                  const calcCap = baseCapacity(binId, binSt);
                                  const hasOverride = Object.prototype.hasOwnProperty.call(capOverrides, binId);
                                  const isDisabled = disabledBins.has(binId);
                                  const eff = hasOverride ? capOverrides[binId] : calcCap;
                                  const rowClasses = isDisabled ? "opacity-50 bg-rose-50/50" : hasOverride ? "bg-indigo-50/50" : "";
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
                                      <td className="px-4 py-2 text-slate-400 text-xs">{rowKey}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{stock}</td>
                                      <td className="px-4 py-2 text-right tabular-nums text-slate-400">{Math.floor(calcCap)}</td>
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
                                          className="w-20 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-right font-mono text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                          <option value="">Default</option>
                                          {Array.from({ length: 44 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                      </td>
                                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${hasOverride ? "text-indigo-600" : ""}`}>
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
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-10 text-center">
                      <div className="font-semibold text-amber-800 mb-1">No consolidation data</div>
                      <div className="text-xs text-amber-600 font-medium">Run a consolidation first to see analytics.</div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Moves</div>
                          <div className="text-2xl font-bold text-indigo-600 tabular-nums">{analytics.totalMoves}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Bins Freed</div>
                          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{analytics.totalFreedBins}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Materials Moved</div>
                          <div className="text-2xl font-bold text-violet-600 tabular-nums">{analytics.uniqueMaterialsMoved}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">PAL Moved</div>
                          <div className="text-2xl font-bold text-amber-600 tabular-nums">{analytics.totalPALMoved.toFixed(1)}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Consolidated</div>
                          <div className="text-2xl font-bold text-slate-800 tabular-nums">{analytics.materialsConsolidated}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto">
                          <SimpleBarChart
                            title="Moves by Source Row"
                            data={Object.entries(analytics.movesBySourceRow).sort((a, b) => b[1] - a[1]).map(([row, count]) => ({ label: row, value: count }))}
                            color="#ef4444"
                          />
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto">
                          <SimpleBarChart
                            title="Moves by Target Row"
                            data={Object.entries(analytics.movesByTargetRow).sort((a, b) => b[1] - a[1]).map(([row, count]) => ({ label: row, value: count }))}
                            color="#10b981"
                          />
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                          <SimpleBarChart
                            title="PAL Moved by Source Row"
                            data={Object.entries(analytics.palMovedByRow).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([row, pal]) => ({ label: row, value: pal }))}
                            color="#f59e0b"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto">
                          <SimpleBarChart
                            title="PAL Moved by Row"
                            data={Object.entries(analytics.palMovedByRow).sort((a, b) => b[1] - a[1]).map(([row, pal]) => ({ label: row, value: pal }))}
                            color="#8b5cf6"
                          />
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
                          <div className="font-semibold text-sm text-slate-500 mb-4">Capacity Utilization</div>
                          <div className="space-y-5">
                            <div>
                              <div className="flex justify-between text-xs mb-2">
                                <span className="font-medium">Before Consolidation</span>
                                <span className="font-medium text-slate-400">{analytics.capacityUtilizationBefore}%</span>
                              </div>
                              {/* FIX: h-full on inner div so it fills the h-4 container */}
                              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${analytics.capacityUtilizationBefore}%` }} />
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {analytics.usedCapacityBefore.toFixed(1)} / {analytics.totalCapacityBefore.toFixed(1)} PAL
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-2">
                                <span className="font-medium">After Consolidation</span>
                                <span className="font-medium text-slate-400">{analytics.capacityUtilizationAfter}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${analytics.capacityUtilizationAfter}%` }} />
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {analytics.usedCapacityAfter.toFixed(1)} / {analytics.totalCapacityAfter.toFixed(1)} PAL
                              </div>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                              <div className="flex justify-between">
                                <span className="font-semibold text-slate-500 text-sm">Capacity Freed</span>
                                <span className="font-bold text-amber-600">+{analytics.capacityFreed.toFixed(1)} PAL</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                          <div className="font-bold text-base">Top Materials by PAL Moved</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                              <tr>
                                <th className="px-4 py-3 text-left">Material ID</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">PAL Moved</th>
                                <th className="px-4 py-3 text-right">%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {analytics.topMaterialsByPAL.map((item, idx) => (
                                <tr key={idx} className={idx < 3 ? "bg-amber-50/50" : ""}>
                                  <td className="px-4 py-2.5 font-mono text-xs">{item.materialId}</td>
                                  <td className="px-4 py-2.5 text-slate-500 truncate max-w-md">{item.materialDesc || ""}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{item.totalPAL.toFixed(1)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
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
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500 text-white rounded-lg font-semibold text-sm hover:bg-indigo-400 transition-colors shadow-sm"
                        >
                          <Download size={15} /> Export Analytics
                        </button>
                        <button
                          onClick={generatePDFReport}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-lg font-semibold text-sm hover:bg-rose-400 transition-colors shadow-sm"
                        >
                          <Download size={15} /> PDF Report
                        </button>
                        <button
                          onClick={() => initialBinState && finalBinState && setShowBeforeAfter(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold text-sm hover:bg-emerald-400 transition-colors shadow-sm"
                        >
                          <RefreshCcw size={15} /> Before / After
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activePane === "MAP" && <WarehouseBinMap />}

              {activePane === "GUIDE" && (
                <div className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-sm">
                  <div className="font-bold text-lg mb-3">Operations Guide</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-600">{USER_GUIDE}</pre>
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
      {skipModalMove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSkipModalMove(null); }}
        >
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden border border-slate-200 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3 text-left">
                <div className="h-9 w-9 rounded-lg bg-rose-500 flex items-center justify-center text-white">
                  <Ban size={18} />
                </div>
                <div>
                  <div className="font-bold text-base tracking-tight text-slate-900">Move Not Doable</div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Report &amp; skip this move</div>
                </div>
              </div>
              <button onClick={() => setSkipModalMove(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-700" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {skipSubmitStatus === "SUCCEEDED" ? (
                <div className="py-8 text-center space-y-3">
                  <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={28} />
                  </div>
                  <div className="font-bold text-emerald-800 text-lg">Move skipped</div>
                  <p className="text-sm text-emerald-600 font-medium">Report sent to the team.</p>
                </div>
              ) : (
                <form onSubmit={handleSkipSubmit} className="space-y-4 text-left">
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Move Details</div>
                    <div className="font-mono font-medium text-sm">
                      #{skipModalMove.id} &nbsp; {skipModalMove.from}
                      <ArrowRight className="inline mx-1.5 text-indigo-400" size={13} />
                      {skipModalMove.to}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">{skipModalMove.materialId}</div>
                    <div className="text-[10px] text-slate-400 truncate">{skipModalMove.materialDesc}</div>
                    <div className="text-xs font-medium text-slate-500">{skipModalMove.qty} PAL</div>
                  </div>
                  <div>
                    <textarea
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      required
                      placeholder="e.g. Bin count doesn't match SAP — expected 5 PAL, found 3"
                      className="w-full h-28 p-4 rounded-lg border border-slate-200 bg-slate-50 font-medium text-sm outline-none focus:ring-2 focus:ring-rose-500 transition resize-none text-slate-700 placeholder:text-slate-300"
                    />
                  </div>
                  {skipSubmitStatus === "ERROR" && (
                    <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                      Failed to send report. Please try again.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={skipSubmitStatus === "SUBMITTING" || !skipReason.trim()}
                    className="w-full py-3 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-400 disabled:opacity-30 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {skipSubmitStatus === "SUBMITTING" ? (
                      <><Loader2 className="animate-spin" size={16} /> Sending…</>
                    ) : (
                      <><Ban size={16} /> Skip &amp; Notify</>
                    )}
                  </button>
                </form>
              )}
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
