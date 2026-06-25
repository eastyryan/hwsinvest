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
    <div style={{ height: 220, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="yield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C5BCB" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#7C5BCB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--faint)", fontSize: 11 }}
            tickFormatter={(d) => String(d).slice(5)}
            minTickGap={30}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--faint)", fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}%`}
            width={45}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bgDeep)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(v) => [`${v}%`, "Yield"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#9B7FE0"
            strokeWidth={2}
            fill="url(#yield)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
