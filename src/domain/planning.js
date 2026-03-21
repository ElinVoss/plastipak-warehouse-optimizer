import { normBin, parseBin, toNum } from "./bin";
import { SIDE_BINS, effectiveCapacity } from "./capacity";
import { buildBinState } from "./sap";

const MIN_FREE_FOR_NONEMPTY = 3;

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const ROW_TIER = {
  A: 1.5, B: 1.3, C: 1.3,
  D: 1.4, E: 1.4,
  F: 1.6, G: 1.6,
  H: 0.7, HH: 0.3,
  I: 0.8, II: 0.6,
  J: 1.0,
};

export function binValue(binId, binState, overrides = {}) {
  const cap = effectiveCapacity(binId, binState, overrides);
  const { rowKey } = parseBin(binId);
  const tier = ROW_TIER[rowKey] ?? 1.0;
  return cap * tier;
}

export function consolidate({
  stockRows,
  emptyBinsSet,
  emptyBinTypes,
  abcThreshold,
  phase2Enabled,
  phase2Threshold,
  allowSrc110,
  allowTgt110,
  allowTgt111,
  lockedBins,
  capOverrides = {},
  disabledBins = new Set(),
  excludeHISource = true,
  excludedBinSet = new Set(),
}) {
  const binState = buildBinState(stockRows);
  const moves = [];
  let moveId = 1;
  const materialDescMap = {};
  for (const r of stockRows) materialDescMap[r.materialId] = r.materialDesc || "";

  const liveFree = (binId) => {
    const cap = effectiveCapacity(binId, binState, capOverrides);
    const used = binState[binId]?.totalQty || 0;
    return Math.max(0, cap - used);
  };

  const isNonEmpty = (binId) => (binState[binId]?.totalQty || 0) > 0;
  const typeOf = (binId) => String(binState[binId]?.storageType || emptyBinTypes?.[binId] || "");

  const canTargetType = (binId) => {
    const t = typeOf(binId);
    if (t === "110" && !allowTgt110) return false;
    if (t === "111" && !allowTgt111) return false;
    return true;
  };

  const canReceiveMaterial = (binId, materialId, fromBinId) => {
    const { rowKey, upper } = parseBin(binId);
    if (rowKey === "A" || rowKey === "B" || rowKey === "C") return false;
    if (SIDE_BINS.has(upper)) return false;
    if (lockedBins?.has(normBin(binId))) return false;
    if (disabledBins?.has(normBin(binId))) return false;
    if (excludedBinSet.has(normBin(binId))) return false;
    if (!canTargetType(binId)) return false;
    const binHasR = normBin(binId).includes("R");
    const fromHasR = normBin(fromBinId).includes("R");
    if (binHasR !== fromHasR) return false;
    if (isNonEmpty(binId)) {
      return binState[binId]?.materials?.has(materialId) === true;
    }
    return true;
  };

  const applyMove = (materialId, from, to, qty, tag = "normal") => {
    const q = Number(qty.toFixed(3));
    if (q <= 0) return;
    moves.push({ id: moveId++, materialId, materialDesc: materialDescMap[materialId] || "", from, to, qty: q, tag });
    if (binState[from]) {
      binState[from].totalQty -= q;
      if (binState[from].totalQty < 1e-6) binState[from].totalQty = 0;
      binState[from].byMaterialQty[materialId] = (binState[from].byMaterialQty[materialId] || 0) - q;
      if (binState[from].byMaterialQty[materialId] < 1e-6) binState[from].byMaterialQty[materialId] = 0;
      if (binState[from].byMaterialQty[materialId] <= 0) {
        delete binState[from].byMaterialQty[materialId];
        binState[from].materials.delete(materialId);
      }
    }
    if (!binState[to]) {
      binState[to] = { totalQty: 0, storageType: emptyBinTypes?.[to] || "", materials: new Set(), byMaterialQty: {}, descByMaterial: {} };
    }
    if (!binState[to].storageType) binState[to].storageType = emptyBinTypes?.[to] || "";
    binState[to].totalQty += q;
    binState[to].materials.add(materialId);
    binState[to].byMaterialQty[materialId] = (binState[to].byMaterialQty[materialId] || 0) + q;
    if (!binState[to].descByMaterial[materialId]) binState[to].descByMaterial[materialId] = materialDescMap[materialId] || "";
  };

  const matTotalQty = {};
  const candidateMoves = [];
  const HIGH_VALUE_ROWS = new Set(["D", "E", "F", "G"]);

  for (const [binId, st] of Object.entries(binState)) {
    for (const [matId, qty] of Object.entries(st.byMaterialQty)) {
      matTotalQty[matId] = (matTotalQty[matId] || 0) + qty;
    }
  }

  const nonEmptyFreeByMat = {};
  for (const [binId, st] of Object.entries(binState)) {
    if ((st.totalQty || 0) <= 0) continue;
    for (const matId of st.materials) {
      const f = Math.max(0, effectiveCapacity(binId, binState, capOverrides) - (st.totalQty || 0));
      nonEmptyFreeByMat[matId] = (nonEmptyFreeByMat[matId] || 0) + f;
    }
  }

  const NEVER_SOURCE_ROWS = excludeHISource ? new Set(["H", "HH", "I", "II"]) : new Set();

  for (const [binId, st] of Object.entries(binState)) {
    if (lockedBins?.has(binId)) continue;
    if (disabledBins?.has(binId)) continue;
    if (st.storageType === "111") continue;
    if (st.storageType === "110" && !allowSrc110) continue;
    const { rowKey } = parseBin(binId);
    if (NEVER_SOURCE_ROWS.has(rowKey)) continue;
    if (excludedBinSet.has(binId)) continue;
    const srcValue = binValue(binId, binState, capOverrides);

    for (const [matId, qty] of Object.entries(st.byMaterialQty)) {
      if (qty <= 0) continue;
      const inPhase1 = ["A", "B", "C"].includes(rowKey) && qty <= abcThreshold;
      const inPhase2 = phase2Enabled && qty <= phase2Threshold;
      const availableNonEmptyFree = (nonEmptyFreeByMat[matId] || 0) - qty;
      const inPhase3 =
        HIGH_VALUE_ROWS.has(rowKey) &&
        qty <= (phase2Enabled ? phase2Threshold : abcThreshold) &&
        availableNonEmptyFree >= 0;
      if (!inPhase1 && !inPhase2 && !inPhase3) continue;
      const phase = inPhase1 ? 1 : inPhase2 ? 2 : 3;
      candidateMoves.push({ phase, from: binId, materialId: matId, qty, sourceValue: srcValue });
    }
  }

  candidateMoves.sort((a, b) => {
    if (b.sourceValue !== a.sourceValue) return b.sourceValue - a.sourceValue;
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (a.qty !== b.qty) return a.qty - b.qty;
    return a.from.localeCompare(b.from);
  });

  const existingBins = Object.keys(binState);
  const emptyBins = Array.from(emptyBinsSet || []).map(normBin).filter(Boolean);
  const recentlyFreed = new Set();

  for (const src of candidateMoves) {
    const from = src.from;
    const materialId = src.materialId;
    let remaining = binState[from]?.byMaterialQty?.[materialId] || 0;
    if (remaining <= 0) continue;

    const { rowKey: sRow } = parseBin(from);

    if (sRow === "J") {
      const jTargets = existingBins
        .filter((t) => t !== from && isNonEmpty(t))
        .filter((t) => canReceiveMaterial(t, materialId, from))
        .filter((t) => liveFree(t) >= MIN_FREE_FOR_NONEMPTY);
      if (jTargets.length === 0) continue;
      jTargets.sort((a, b) => liveFree(b) - liveFree(a));
      const top2 = jTargets.slice(0, 2);
      if (top2.reduce((s, t) => s + liveFree(t), 0) < remaining) continue;
      for (const t of top2) {
        const space = liveFree(t);
        if (space <= 0) continue;
        const moveQty = Math.min(space, remaining);
        if (moveQty > 0) { applyMove(materialId, from, t, moveQty); remaining -= moveQty; }
        if (remaining <= 0) break;
      }
      if ((binState[from]?.totalQty || 0) < 1e-6) recentlyFreed.add(from);
      continue;
    }

    const nonEmptyTargets = existingBins
      .filter((t) => t !== from && isNonEmpty(t))
      .filter((t) => canReceiveMaterial(t, materialId, from))
      .filter((t) => liveFree(t) >= MIN_FREE_FOR_NONEMPTY);

    const pool = nonEmptyTargets;
    if (!pool.length) continue;

    const srcBinVal = binValue(from, binState, capOverrides);

    const LAST_RESORT_TARGET_ROWS = new Set(["H", "HH", "I", "II"]);

    const score = (t) => {
      const sameMat = binState[t]?.materials?.has(materialId) ? 1 : 0;
      const { rowKey: tRow } = parseBin(t);
      const sameRow = tRow === sRow ? 1 : 0;
      const preferredRow = LAST_RESORT_TARGET_ROWS.has(tRow) ? 0 : 1;
      const free = liveFree(t);
      const fitsAll = free >= remaining ? 1 : 0;
      const targetCap = effectiveCapacity(t, binState, capOverrides);
      const smallTargetBonus = Math.max(0, 50 - targetCap);
      const sourceFreedBonus = fitsAll ? srcBinVal : 0;
      const lex = 1 / (1 + Math.abs(hashString(t) % 997));
      return (
        sameMat * 1_000_000 +
        preferredRow * 500_000 +
        fitsAll * 100_000 +
        sameRow * 50_000 +
        sourceFreedBonus * 1_000 +
        smallTargetBonus * 500 +
        free * 100 +
        lex
      );
    };

    pool.sort((a, b) => score(b) - score(a) || a.localeCompare(b));

    const oneShot = pool.find((t) => liveFree(t) >= remaining);
    if (oneShot) {
      applyMove(materialId, from, oneShot, remaining);
      if ((binState[from]?.totalQty || 0) < 1e-6) recentlyFreed.add(from);
      continue;
    }

    const totalFree = pool.reduce((s, t) => s + liveFree(t), 0);
    if (totalFree < remaining) continue;

    let remainingPool = pool.filter((t) => liveFree(t) > 0);
    while (remaining > 0 && remainingPool.length > 0) {
      remainingPool = remainingPool.filter((t) => liveFree(t) > 0);
      if (!remainingPool.length) break;
      remainingPool.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
      const best = remainingPool[0];
      const space = liveFree(best);
      if (space <= 0) { remainingPool.shift(); continue; }
      const moveQty = Math.min(space, remaining);
      if (moveQty > 0) { applyMove(materialId, from, best, moveQty); remaining -= moveQty; }
      if (liveFree(best) <= 0) remainingPool.shift();
    }
    if ((binState[from]?.totalQty || 0) < 1e-6) recentlyFreed.add(from);
  }

  const matBinsPass2 = {};
  for (const [binId, st] of Object.entries(binState)) {
    if ((st.totalQty || 0) <= 0) continue;
    if (st.materials.size !== 1) continue;
    if (lockedBins?.has(binId)) continue;
    if (disabledBins?.has(binId)) continue;
    if (st.storageType === "111") continue;
    if (st.storageType === "110" && !allowSrc110) continue;
    const { rowKey: srcRow } = parseBin(binId);
    if (NEVER_SOURCE_ROWS.has(srcRow)) continue;
    if (excludedBinSet.has(binId)) continue;
    const matId = Array.from(st.materials)[0];
    const qty = st.byMaterialQty[matId] || 0;
    if (qty <= 0) continue;
    if (!matBinsPass2[matId]) matBinsPass2[matId] = [];
    matBinsPass2[matId].push({ binId, qty });
  }

  for (const [matId, sources] of Object.entries(matBinsPass2)) {
    if (sources.length < 2) continue;
    sources.sort((a, b) => a.qty - b.qty);

    const emptyTargets = emptyBins
      .filter((t) => !isNonEmpty(t))
      .filter((t) => !recentlyFreed.has(t))
      .filter((t) => canReceiveMaterial(t, matId, sources[0].binId))
      .filter((t) => effectiveCapacity(t, binState, capOverrides) > 0);

    if (!emptyTargets.length) continue;

    emptyTargets.sort((a, b) => {
      const aPreferred = NEVER_SOURCE_ROWS.has(parseBin(a).rowKey) ? 1 : 0;
      const bPreferred = NEVER_SOURCE_ROWS.has(parseBin(b).rowKey) ? 1 : 0;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return effectiveCapacity(b, binState, capOverrides) - effectiveCapacity(a, binState, capOverrides);
    });

    for (const emptyBin of emptyTargets) {
      const cap = effectiveCapacity(emptyBin, binState, capOverrides);
      const selected = [];
      let cumQty = 0;
      for (const src of sources) {
        if (cumQty + src.qty > cap) continue;
        if ((binState[src.binId]?.byMaterialQty?.[matId] || 0) < src.qty - 1e-6) continue;
        selected.push(src);
        cumQty += src.qty;
      }
      if (selected.length < 2) continue;
      for (const src of selected) {
        applyMove(matId, src.binId, emptyBin, src.qty);
        if ((binState[src.binId]?.totalQty || 0) < 1e-6) recentlyFreed.add(src.binId);
      }
      break;
    }
  }

  return { moves, finalBinState: binState };
}

export function findBestBin({ query, qtyNeeded, stockRows, emptyBinsSet, emptyBinTypes, allowAB, allowTgt110, allowTgt111, capOverrides = {} }) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { ok: false, reason: "Enter a material number or description." };
  const need = toNum(qtyNeeded);
  const binState = buildBinState(stockRows);
  const materialMap = {};
  for (const r of stockRows) {
    if (!materialMap[r.materialId]) materialMap[r.materialId] = r.materialDesc || "";
  }
  const ids = Object.keys(materialMap);
  const matchedId =
    ids.find((id) => id.toLowerCase() === q) ||
    ids.find((id) => id.toLowerCase().startsWith(q)) ||
    ids.find((id) => (materialMap[id] || "").toLowerCase().includes(q));
  if (!matchedId) return { ok: false, reason: "No material match found in the loaded export." };

  let materialIsR = null;
  for (const b of Object.keys(binState)) {
    if (binState[b]?.materials?.has(matchedId)) { materialIsR = b.includes("R"); break; }
  }

  const allowedTargetType = (type) => {
    if (type === "110") return !!allowTgt110;
    if (type === "111") return !!allowTgt111;
    return true;
  };

  const free = (bin) => {
    const cap = effectiveCapacity(bin, binState, capOverrides);
    const used = binState[bin]?.totalQty || 0;
    return Math.max(0, cap - used);
  };

  const typeOf = (bin) => String(binState[bin]?.storageType || emptyBinTypes?.[bin] || "");
  const isNonEmpty = (bin) => (binState[bin]?.totalQty || 0) > 0;

  const canUse = (bin) => {
    const B = normBin(bin);
    if (!B) return false;
    const { rowKey } = parseBin(B);
    if (!allowAB && (rowKey === "A" || rowKey === "B" || rowKey === "C")) return false;
    const t = typeOf(B);
    if (!allowedTargetType(t)) return false;
    if (materialIsR !== null && B.includes("R") !== materialIsR) return false;
    const f = free(B);
    if (f <= 0) return false;
    if (need > 0 && f < need) return false;
    if (isNonEmpty(B)) {
      if (!binState[B]?.materials?.has(matchedId)) return false;
    }
    return true;
  };

  const candidates = [];
  for (const b of Object.keys(binState)) {
    if (binState[b]?.materials?.has(matchedId) && canUse(b)) {
      candidates.push({ bin: b, free: free(b), cap: effectiveCapacity(b, binState, capOverrides), storageType: typeOf(b), sameMaterial: true, emptyPreferred: false });
    }
  }
  for (const b of Array.from(emptyBinsSet || [])) {
    const B = normBin(b);
    if (!B || (binState[B]?.totalQty || 0) > 0) continue;
    const t = String(emptyBinTypes?.[B] || "");
    if (t && !allowedTargetType(t)) continue;
    if (canUse(B)) {
      candidates.push({ bin: B, free: effectiveCapacity(B, binState, capOverrides), cap: effectiveCapacity(B, binState, capOverrides), storageType: t, sameMaterial: false, emptyPreferred: true });
    }
  }

  if (!candidates.length) return { ok: false, reason: "No suitable bin found under the current rules." };

  candidates.sort((a, b) => {
    if (a.sameMaterial !== b.sameMaterial) return a.sameMaterial ? -1 : 1;
    if (a.emptyPreferred !== b.emptyPreferred) return a.emptyPreferred ? -1 : 1;
    if (a.free !== b.free) return b.free - a.free;
    return a.bin.localeCompare(b.bin);
  });

  return { ok: true, materialId: matchedId, materialDesc: materialMap[matchedId] || "", best: candidates[0], top: candidates.slice(0, 10) };
}
