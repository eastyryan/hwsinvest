import YieldChart from "@/components/YieldChart";
import { getLatest, getHistory } from "@/lib/fred";

export const metadata = { title: "Economy · HWS Investment Club" };
export const dynamic = "force-dynamic";

const SERIES = [
  { id: "DGS2", label: "2-Year Treasury", unit: "%", note: "daily" },
  { id: "DGS10", label: "10-Year Treasury", unit: "%", note: "daily" },
  { id: "DGS30", label: "30-Year Treasury", unit: "%", note: "daily" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%", note: "monthly" },
  { id: "UNRATE", label: "Unemployment", unit: "%", note: "monthly" },
  { id: "CPIAUCSL", label: "CPI (Index)", unit: "", note: "monthly" },
];

export default async function EconomyPage() {
  const [stats, history] = await Promise.all([
    Promise.all(SERIES.map((s) => getLatest(s.id))),
    getHistory("DGS10", 90),
  ]);

  const dgs10 = stats[SERIES.findIndex((s) => s.id === "DGS10")];
  const latestYield = dgs10 ? `${dgs10.value}%` : "—";

  return (
    <main>
      {/* Page header */}
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <p className="kicker">Economy</p>
          <h1 className="h-page">Bonds, rates &amp; the economy</h1>
          <p className="lede">
            Authoritative data from the Federal Reserve Bank of St. Louis (FRED).
            Treasury yields update each business day.
          </p>
        </div>
      </section>

      {/* Stat cards */}
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {SERIES.map((s, i) => {
            const d = stats[i];
            return (
              <div key={s.id} className="card" style={{ padding: 20, borderRadius: 13 }}>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, lineHeight: 1.3 }}>
                  {s.label}
                </p>
                <p
                  className="mono nums"
                  style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", margin: "12px 0 0" }}
                >
                  {d ? `${d.value}${s.unit}` : "—"}
                </p>
                <p
                  className="mono"
                  style={{ fontSize: 11, color: "var(--faint)", margin: "7px 0 0", letterSpacing: "0.05em" }}
                >
                  {d ? `as of ${d.date}` : s.note} · {s.id}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 10-Year yield chart */}
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <h2 className="h-sub">10-Year Treasury yield</h2>
        <p className="lede" style={{ maxWidth: 600, margin: "11px 0 22px" }}>
          The benchmark rate that influences mortgages, corporate borrowing, and
          equity valuations. Last ~90 observations.
        </p>
        <div
          className="card"
          style={{ padding: "clamp(20px,3vw,30px)", borderRadius: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              DGS10 · daily
            </span>
            <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--brand)" }}>
              {latestYield}
            </span>
          </div>
          <YieldChart data={history} />
        </div>
      </section>
    </main>
  );
}
