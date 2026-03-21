export default function SimpleBarChart({ data, title, color = "#3b82f6" }) {
  if (!data || data.length === 0) return <div className="text-center text-slate-400 py-8 text-sm">No data</div>;

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      <div className="font-semibold text-sm text-slate-500">{title}</div>
      <div className="flex flex-col gap-2">
        {data.map((item, idx) => {
          const widthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
          const displayValue = typeof item.value === "number" && item.value % 1 !== 0 ? item.value.toFixed(1) : item.value;
          return (
            <div key={idx} className="w-full">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">{item.label}</span>
                <span className="font-medium text-slate-400 tabular-nums">{displayValue}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
