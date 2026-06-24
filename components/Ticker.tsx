"use client";

import { useEffect, useState } from "react";

type Q = { symbol: string; c: number; dp: number };

const SYMBOLS = ["SPY", "QQQ", "DIA", "IWM", "AAPL", "MSFT", "NVDA", "XLE", "XLF"];

export default function Ticker() {
  const [quotes, setQuotes] = useState<Q[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/quote?symbols=${SYMBOLS.join(",")}`);
        const json = await res.json();
        if (active && json.quotes) setQuotes(json.quotes);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60000); // refresh each minute
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (quotes.length === 0) {
    return (
      <div className="border-y border-line bg-panel py-2 text-center text-xs text-gray-500">
        Loading market data…
      </div>
    );
  }

  const row = [...quotes, ...quotes]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden border-y border-line bg-panel">
      <div className="animate-marquee flex w-max gap-8 py-2 text-sm nums">
        {row.map((q, i) => {
          const up = q.dp >= 0;
          return (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-semibold text-white">{q.symbol}</span>
              <span className="text-gray-300">{q.c?.toFixed(2)}</span>
              <span className={up ? "text-up" : "text-down"}>
                {up ? "▲" : "▼"} {q.dp?.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
