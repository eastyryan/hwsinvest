"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function YieldChart({
  data,
}: {
  data: { date: string; value: number }[];
}) {
  return (
    <div className="h-64 w-full rounded-xl border border-line bg-panel p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="yield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E87722" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#E87722" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "#8b929c", fontSize: 11 }}
            tickFormatter={(d) => String(d).slice(5)}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: "#8b929c", fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}%`}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: "#0E1116",
              border: "1px solid #2A2F37",
              borderRadius: 8,
              color: "#fff",
            }}
            formatter={(v) => [`${v}%`, "Yield"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#E87722"
            strokeWidth={2}
            fill="url(#yield)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
