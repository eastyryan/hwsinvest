"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatEcon, type EconFmt } from "@/lib/format";

export default function MiniChart({
  data,
  fmt,
}: {
  data: { date: string; value: number }[];
  fmt: EconFmt;
}) {
  return (
    <div style={{ height: 180, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id={`econ-${fmt}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4b2e83" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#4b2e83" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--faint)", fontSize: 10 }}
            tickFormatter={(d) => String(d).slice(0, 7)}
            minTickGap={36}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--faint)", fontSize: 10 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => formatEcon(Number(v), fmt)}
            width={52}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(v) => [formatEcon(Number(v), fmt), ""]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6d4fb8"
            strokeWidth={2}
            fill={`url(#econ-${fmt})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
