import React from "react";

export function MessageBubble({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#1f2933] text-stone-100 px-4 py-2.5 text-sm font-semibold">
          {message.text}
        </div>
      </div>
    );
  }

  const isError = message.type === "error";
  const bgClass = isError
    ? "bg-rose-50 border-rose-200"
    : "bg-[#fcfaf6] border-stone-200";

  return (
    <div className="flex justify-start">
      <div className={`max-w-[90%] rounded-2xl rounded-bl-md border ${bgClass} px-4 py-3 text-sm space-y-2`}>
        {message.highlight && (
          <span className="inline-block bg-amber-100 text-amber-800 font-bold text-xs px-2 py-0.5 rounded-lg mb-1">
            {message.highlight}
          </span>
        )}

        {message.text && (
          <div className={`font-semibold leading-relaxed ${isError ? "text-rose-800" : "text-stone-800"}`}>
            <BoldText text={message.text} />
          </div>
        )}

        {message.items && message.items.length > 0 && (
          <ul className="space-y-1 pl-1">
            {message.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-stone-700">
                <span className="text-amber-500 font-bold mt-0.5">&#8250;</span>
                <span><BoldText text={item} /></span>
              </li>
            ))}
          </ul>
        )}

        {message.table && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  {message.table.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-bold text-stone-500 uppercase tracking-wider text-[10px] border-b border-stone-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-stone-100 last:border-0">
                    {message.table.headers.map((h, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-stone-700 font-mono font-semibold">
                        {row[h] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BoldText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return part.split("\n").map((line, li, arr) => (
          <React.Fragment key={`${i}-${li}`}>
            {line}
            {li < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </>
  );
}
