import { X } from "lucide-react";

export default function BeforeAfterModal({ isOpen, onClose, initialBinState, finalBinState, freedBins, parseBin }) {
  if (!isOpen) return null;

  const allBins = Array.from(
    new Set([...(Object.keys(initialBinState || {})), ...(Object.keys(finalBinState || {}))])
  ).sort();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">Warehouse State Comparison</div>
            <div className="text-sm text-slate-400 mt-0.5">Before vs After Consolidation</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Bin</th>
                  <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Row</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-slate-400 tracking-wider border-l-2 border-slate-200">Before Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Before Mats</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-slate-400 tracking-wider border-l-2 border-slate-200">After Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-slate-400 tracking-wider">After Mats</th>
                  <th className="px-4 py-3 text-center font-semibold text-[10px] uppercase text-slate-400 tracking-wider border-l-2 border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allBins.map((binId) => {
                  const before = initialBinState?.[binId];
                  const after = finalBinState?.[binId];
                  const wasFreed = (freedBins || []).includes(binId);
                  if (!before && !after) return null;

                  const beforeQty = before?.totalQty || 0;
                  const afterQty = after?.totalQty || 0;
                  const beforeMats = before?.materials?.size || 0;
                  const afterMats = after?.materials?.size || 0;

                  let status = "UNCHANGED";
                  let statusColor = "bg-slate-100 text-slate-500";
                  if (wasFreed) { status = "FREED"; statusColor = "bg-emerald-50 text-emerald-700"; }
                  else if (afterQty > beforeQty) { status = "RECEIVED"; statusColor = "bg-indigo-50 text-indigo-700"; }
                  else if (afterQty < beforeQty) { status = "EMPTIED"; statusColor = "bg-amber-50 text-amber-700"; }
                  else if (afterQty === 0 && beforeQty === 0) { status = "EMPTY"; statusColor = "bg-slate-50 text-slate-400"; }

                  return (
                    <tr key={binId} className={wasFreed ? "bg-emerald-50/50" : ""}>
                      <td className="px-4 py-2 font-mono font-medium text-xs">{binId}</td>
                      <td className="px-4 py-2 text-slate-400">{parseBin(binId).rowKey}</td>
                      <td className="px-4 py-2 text-right tabular-nums border-l-2 border-slate-100 font-medium">{beforeQty > 0 ? beforeQty.toFixed(1) : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-400">{beforeMats || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums border-l-2 border-slate-100 font-medium">{afterQty > 0 ? afterQty.toFixed(1) : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-400">{afterMats || "—"}</td>
                      <td className="px-4 py-2 text-center border-l-2 border-slate-100">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusColor}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-slate-200 font-semibold text-sm hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
