import { normBin, toNum } from "./bin";

const REQUIRED_HEADERS = ["Storage Bin", "Material", "Material Description", "Available stock", "Storage Type"];

export function validateSapHeaders(rows) {
  const keys = new Set();
  (rows || [])
    .slice(0, 25)
    .forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(String(k))));
  return REQUIRED_HEADERS.filter((h) => !keys.has(h));
}

export function parseSapExport(json) {
  const stockRows = [];
  const emptyBinsFromExport = new Set();
  const emptyBinTypes = {};
  for (const r of json || []) {
    const bin = normBin(r["Storage Bin"]);
    if (!bin) continue;
    const materialId = String(r["Material"] ?? "").trim();
    const materialDesc = String(r["Material Description"] ?? "").trim();
    const qty = toNum(r["Available stock"]);
    const storageType = String(r["Storage Type"] ?? "").trim();
    const emptyIndicator = String(r["Empty indicator"] ?? "").trim().toUpperCase();
    const isEmpty = qty === 0 || emptyIndicator === "X";
    if (isEmpty) {
      emptyBinsFromExport.add(bin);
      if (storageType) emptyBinTypes[bin] = storageType;
      continue;
    }
    if (materialId && qty > 0) {
      stockRows.push({ bin, materialId, materialDesc, qty, storageType });
    }
  }
  return { stockRows, emptyBinsFromExport, emptyBinTypes };
}

export function buildBinState(stockRows) {
  const bin = {};
  for (const r of stockRows) {
    if (!bin[r.bin]) {
      bin[r.bin] = {
        totalQty: 0,
        storageType: r.storageType || "",
        materials: new Set(),
        byMaterialQty: {},
        descByMaterial: {},
      };
    }
    bin[r.bin].totalQty += r.qty;
    bin[r.bin].materials.add(r.materialId);
    bin[r.bin].byMaterialQty[r.materialId] = (bin[r.bin].byMaterialQty[r.materialId] || 0) + r.qty;
    if (!bin[r.bin].descByMaterial[r.materialId]) {
      bin[r.bin].descByMaterial[r.materialId] = r.materialDesc || "";
    }
    if (!bin[r.bin].storageType && r.storageType) {
      bin[r.bin].storageType = r.storageType;
    }
  }
  return bin;
}
