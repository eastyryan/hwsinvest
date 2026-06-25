import Link from "next/link";
import Ticker from "@/components/Ticker";
import IndexCard from "@/components/IndexCard";
import YieldChart from "@/components/YieldChart";
import { getQuotes } from "@/lib/finnhub";
import { getLatest, getHistory } from "@/lib/fred";
import { indices, sectors } from "@/data/sectors";
import { usd, pct, isUp, arrow } from "@/lib/format";

const SERIES = [
  { id: "DGS2", label: "2-Year Treasury", unit: "%", note: "daily" },
  { id: "DGS10", label: "10-Year Treasury", unit: "%", note: "daily" },
  { id: "DGS30", label: "30-Year Treasury", unit: "%", note: "daily" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%", note: "monthly" },
  { id: "UNRATE", label: "Unemployment", unit: "%", note: "monthly" },
  { id: "CPIAUCSL", label: "CPI (Index)", unit: "", note: "monthly" },
  { id: "GDPC1", label: "Real GDP", unit: "B", note: "quarterly" },
  { id: "PCEPILFE", label: "Core PCE (Index)", unit: "", note: "monthly" },
  { id: "PAYEMS", label: "Nonfarm Payrolls", unit: "K", note: "monthly" },
  { id: "UMCSENT", label: "Consumer Sentiment", unit: "", note: "monthly" },
  { id: "MORTGAGE30US", label: "30-Yr Mortgage", unit: "%", note: "weekly" },
  { id: "T10Y2Y", label: "10Y–2Y Spread", unit: "%", note: "daily" },
];

export const metadata = { title: "Markets · HWS Investment Club" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [indexQuotes, sectorQuotes, econStats, history] = await Promise.all([
    getQuotes(indices.map((i) => i.symbol)),
    getQuotes(sectors.map((s) => s.etf)),
    Promise.all(SERIES.map((s) => getLatest(s.id))),
    getHistory("DGS10", 90),
  ]);

  const dgs10 = econStats[SERIES.findIndex((s) => s.id === "DGS10")];
  const latestYield = dgs10 ? `${dgs10.value}%` : "—";

  return (
    <main>
      {/* Page header */}
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <p className="kicker">Markets &amp; Economy</p>
          <h1 className="h-page">The markets, in one place</h1>
          <p className="lede" style={{ maxWidth: 640 }}>
            Live equities via index and sector ETFs, the names the club is
            researching, and the rates and economic data that drive it all.
          </p>
        </div>
      </section>

      <Ticker topBorder={false} />

      {/* Section nav */}
      <section className="container-x" style={{ paddingTop: "clamp(32px,4vh,48px)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            ["#indices", "Indices"],
            ["#sectors", "Sectors"],
            ["#economy", "Economy"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="mono link-muted"
              style={{
                fontSize: 12.5,
                letterSpacing: "0.06em",
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      {/* Major indices */}
      <section id="indices" className="container-x" style={{ paddingTop: "clamp(40px,5vh,60px)", scrollMarginTop: 80 }}>
        <h2 className="h-sub" style={{ marginBottom: 24 }}>
          Major indices
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
          }}
        >
          {indexQuotes.map((q) => {
            const label = indices.find((i) => i.symbol === q.symbol)?.label;
            return <IndexCard key={q.symbol} quote={q} label={label} etf={q.symbol} />;
          })}
        </div>
      </section>

      {/* Sectors */}
      <section id="sectors" className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)", scrollMarginTop: 80 }}>
        <h2 className="h-sub">Explore by sector</h2>
        <p className="lede" style={{ maxWidth: 560, margin: "11px 0 24px" }}>
          Each sector maps to its SPDR ETF, with a few representative names the
          club follows.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {sectors.map((s) => {
            const q = sectorQuotes.find((x) => x.symbol === s.etf);
            const up = isUp(q?.dp);
            return (
              <Link
                key={s.slug}
                href={`/markets/${s.slug}`}
                className="card card-hover-orange"
                style={{ display: "block", padding: 22, textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{s.name}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--brand)",
                      background: "var(--card2)",
                      border: "1px solid var(--line)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {s.etf}
                  </span>
                </div>
                {q && (
                  <p
                    className="mono"
                    style={{
                      fontSize: 14,
                      color: up ? "var(--up)" : "var(--down)",
                      margin: "11px 0 0",
                      fontWeight: 500,
                    }}
                  >
                    {usd(q.c)} · {arrow(q.dp)} {pct(q.dp)}
                  </p>
                )}
                <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55, margin: "11px 0 0" }}>
                  {s.blurb}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                  {s.holdings.map((h) => (
                    <span
                      key={h}
                      className="mono"
                      style={{
                        fontSize: "11.5px",
                        color: "var(--muted)",
                        background: "var(--card2)",
                        border: "1px solid var(--lineSoft)",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------------- Economy ---------------- */}
      <section id="economy" className="container-x" style={{ paddingTop: "clamp(56px,8vh,90px)", scrollMarginTop: 80 }}>
        <p className="kicker">Economy</p>
        <h2 className="h-sub" style={{ margin: "8px 0 0" }}>
          Bonds, rates &amp; the economy
        </h2>
        <p className="lede" style={{ maxWidth: 600, margin: "11px 0 24px" }}>
          Authoritative data from the Federal Reserve Bank of St. Louis (FRED).
          Treasury yields update each business day.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {SERIES.map((s, i) => {
            const d = econStats[i];
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
      <section className="container-x" style={{ paddingTop: "clamp(40px,5vh,60px)" }}>
        <h2 className="h-sub">10-Year Treasury yield</h2>
        <p className="lede" style={{ maxWidth: 600, margin: "11px 0 22px" }}>
          The benchmark rate that influences mortgages, corporate borrowing, and
          equity valuations. Last ~90 observations.
        </p>
        <div className="card" style={{ padding: "clamp(20px,3vw,30px)", borderRadius: 16 }}>
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
