// Chart palette for the research tool. Recharts writes these straight into SVG
// attributes, so they're literals rather than var() references — keep them in
// sync with the matching tokens in globals.css.

export const CHART = {
  brand: "#4b2e83", // --brandSolid
  orange: "#e87722", // --orange
  green: "#15803d", // --up
  negative: "#dc2626", // --down
  grid: "#e4e4e7", // --line
  muted: "#8a8a90", // --faint
};

/** Fixed categorical order — color follows the company slot, never re-cycled. */
export const SERIES = [CHART.brand, CHART.orange, CHART.green];

export const AXIS_TICK = { fill: CHART.muted, fontSize: 11 } as const;

export const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: `1px solid ${CHART.grid}`,
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 10px 28px rgba(20,20,20,0.10)",
} as const;
