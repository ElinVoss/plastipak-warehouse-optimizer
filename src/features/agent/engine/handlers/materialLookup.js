export function handleMaterialLookup(ctx) {
  const { entities, binState, rawInput } = ctx;

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  let query = entities.materials[0] || "";
  if (!query) {
    const match = rawInput.match(/\d{5,18}/);
    if (match) query = match[0];
  }
  if (!query) {
    return { type: "info", text: "Which material? Try **\"Where is material 12345?\"**" };
  }

  const results = [];
  for (const [binId, entry] of Object.entries(binState)) {
    for (const [matId, qty] of Object.entries(entry.byMaterialQty || {})) {
      if (matId === query || matId.startsWith(query)) {
        results.push({
          Bin: binId,
          Material: matId,
          Description: (entry.descByMaterial?.[matId] || "").slice(0, 30),
          PAL: qty,
        });
      }
    }
  }

  if (results.length === 0) {
    const q = query.toLowerCase();
    for (const [binId, entry] of Object.entries(binState)) {
      for (const [matId] of Object.entries(entry.byMaterialQty || {})) {
        const desc = (entry.descByMaterial?.[matId] || "").toLowerCase();
        if (desc.includes(q)) {
          results.push({
            Bin: binId,
            Material: matId,
            Description: (entry.descByMaterial?.[matId] || "").slice(0, 30),
            PAL: entry.byMaterialQty[matId],
          });
        }
      }
    }
  }

  if (results.length === 0) {
    return { type: "info", text: `Material **${query}** not found in any bin.` };
  }

  results.sort((a, b) => b.PAL - a.PAL);
  const totalQty = results.reduce((s, r) => s + r.PAL, 0);
  const display = results.slice(0, 15);

  return {
    type: "table",
    text: `Material **${query}** found in **${results.length}** bin${results.length !== 1 ? "s" : ""} (${totalQty} PAL total)${results.length > 15 ? " — showing top 15" : ""}`,
    table: { headers: ["Bin", "Material", "Description", "PAL"], rows: display },
  };
}
