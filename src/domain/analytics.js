import { parseBin, toNum } from "./bin";
import { effectiveCapacity } from "./capacity";

export function calculateAnalytics({
  moves,
  initialBinState,
  finalBinState,
  stockRows,
  freedBins,
  capOverrides,
}) {
  const movesBySourceRow = {};
  const movesByTargetRow = {};
  const palMovedByRow = {};
  const materialsMoved = new Set();
  const matPalMoved = {};

  for (const move of moves || []) {
    const srcRow = parseBin(move.from).rowKey;
    const tgtRow = parseBin(move.to).rowKey;
    movesBySourceRow[srcRow] = (movesBySourceRow[srcRow] || 0) + 1;
    movesByTargetRow[tgtRow] = (movesByTargetRow[tgtRow] || 0) + 1;
    palMovedByRow[srcRow] = (palMovedByRow[srcRow] || 0) + toNum(move.qty);
    materialsMoved.add(move.materialId);
    matPalMoved[move.materialId] = (matPalMoved[move.materialId] || 0) + toNum(move.qty);
  }

  const materialBinCountBefore = {};
  const materialBinCountAfter = {};

  for (const binData of Object.values(initialBinState || {})) {
    for (const matId of binData?.materials || []) {
      materialBinCountBefore[matId] = (materialBinCountBefore[matId] || 0) + 1;
    }
  }

  for (const binData of Object.values(finalBinState || {})) {
    for (const matId of binData?.materials || []) {
      materialBinCountAfter[matId] = (materialBinCountAfter[matId] || 0) + 1;
    }
  }

  let consolidatedCount = 0;
  const consolidationDetails = [];
  for (const matId of Object.keys(materialBinCountBefore)) {
    const before = materialBinCountBefore[matId] || 0;
    const after = materialBinCountAfter[matId] || 0;
    if (before > after && after > 0) {
      consolidatedCount++;
      consolidationDetails.push({ materialId: matId, binsBefore: before, binsAfter: after, reduction: before - after });
    }
  }

  let totalCapacityBefore = 0;
  let usedCapacityBefore = 0;
  let totalCapacityAfter = 0;
  let usedCapacityAfter = 0;

  for (const [binId, binData] of Object.entries(initialBinState || {})) {
    totalCapacityBefore += effectiveCapacity(binId, initialBinState, capOverrides || {});
    usedCapacityBefore += toNum(binData?.totalQty);
  }

  for (const [binId, binData] of Object.entries(finalBinState || {})) {
    totalCapacityAfter += effectiveCapacity(binId, finalBinState, capOverrides || {});
    usedCapacityAfter += toNum(binData?.totalQty);
  }

  const capacityUtilizationBefore = totalCapacityBefore > 0 ? +((usedCapacityBefore / totalCapacityBefore) * 100).toFixed(1) : 0;
  const capacityUtilizationAfter = totalCapacityAfter > 0 ? +((usedCapacityAfter / totalCapacityAfter) * 100).toFixed(1) : 0;

  const freedCapacity = (freedBins || []).reduce(
    (sum, b) => sum + effectiveCapacity(b, initialBinState || {}, capOverrides || {}),
    0
  );

  const materialDescMap = {};
  for (const r of stockRows || []) {
    if (!materialDescMap[r.materialId]) materialDescMap[r.materialId] = r.materialDesc || "";
  }

  const topMaterialsByPAL = Object.entries(matPalMoved)
    .map(([materialId, totalPAL]) => ({ materialId, materialDesc: materialDescMap[materialId] || "", totalPAL }))
    .sort((a, b) => b.totalPAL - a.totalPAL)
    .slice(0, 10);

  const totalPALMoved = (moves || []).reduce((sum, m) => sum + toNum(m.qty), 0);

  return {
    totalMoves: (moves || []).length,
    totalFreedBins: (freedBins || []).length,
    uniqueMaterialsMoved: materialsMoved.size,
    materialsConsolidated: consolidatedCount,
    totalPALMoved,
    movesBySourceRow,
    movesByTargetRow,
    palMovedByRow,
    consolidationDetails,
    capacityUtilizationBefore,
    capacityUtilizationAfter,
    totalCapacityBefore,
    totalCapacityAfter,
    usedCapacityBefore,
    usedCapacityAfter,
    capacityFreed: freedCapacity,
    topMaterialsByPAL,
  };
}
