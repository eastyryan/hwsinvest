import Link from "next/link";
import Ticker from "@/components/Ticker";
import IndexCard from "@/components/IndexCard";
import YieldChart from "@/components/YieldChart";
import EconCard, { type EconSeries } from "@/components/EconCard";
import { getQuotes } from "@/lib/finnhub";
import { getHistory } from "@/lib/fred";
import { indices, sectors } from "@/data/sectors";
import { usd, pct, isUp, arrow, yoyChange } from "@/lib/format";

import type { EconFmt } from "@/lib/format";

const SERIES: { id: string; label: string; fmt: EconFmt; note: string }[] = [
  { id: "DGS2", label: "2-Year Treasury", fmt: "pct", note: "daily" },
  { id: "DGS10", label: "10-Year Treasury", fmt: "pct", note: "daily" },
  { id: "DGS30", label: "30-Year Treasury", fmt: "pct", note: "daily" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", fmt: "pct", note: "monthly" },
  { id: "UNRATE", label: "Unemployment", fmt: "pct", note: "monthly" },
  { id: "CPIAUCSL", label: "CPI (Index)", fmt: "index", note: "monthly" },
  { id: "GDPC1", label: "Real GDP", fmt: "gdp", note: "quarterly" },
  { id: "PCEPILFE", label: "Core PCE (Index)", fmt: "index", note: "monthly" },
  { id: "PAYEMS", label: "Nonfarm Payrolls", fmt: "payrolls", note: "monthly" },
  { id: "UMCSENT", label: "Consumer Sentiment", fmt: "sentiment", note: "monthly" },
  { id: "MORTGAGE30US", label: "30-Yr Mortgage", fmt: "pct", note: "weekly" },
  { id: "T10Y2Y", label: "10Y–2Y Spread", fmt: "pct", note: "daily" },
];

export const metadata = { title: "Markets · HWS Investment Club" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [indexQuotes, sectorQuotes, histories] = await Promise.all([
    getQuotes(indices.map((i) => i.symbol)),
    getQuotes(sectors.map((s) => s.etf)),
    Promise.all(SERIES.map((s) => getHistory(s.id, 800))),
  ]);

  const DAY = 24 * 3600 * 1000;
  const econ: EconSeries[] = SERIES.map((s, i) => {
    const hist = histories[i];
    if (!hist.length) {
      return { ...s, value: null, date: null, yoy: null, history: [] };
    }
    const latest = hist[hist.length - 1];

    // Find the observation closest to one year before the latest reading.
    const yearAgo = new Date(latest.date).getTime() - 365 * DAY;
    let prior = hist[0];
    let best = Infinity;
    for (const p of hist) {
      const diff = Math.abs(new Date(p.date).getTime() - yearAgo);
      if (diff < best) {
        best = diff;
        prior = p;
      }
    }
    const yoy =
      prior.date !== latest.date && best < 60 * DAY
        ? yoyChange(latest.value, prior.value, s.fmt)
        : null;

    // Downsample to ~80 points for the expandable chart.
    const step = Math.max(1, Math.floor(hist.length / 80));
    const chart = hist.filter((_, idx) => idx % step === 0);
    if (chart[chart.length - 1]?.date !== latest.date) chart.push(latest);

    return { ...s, value: latest.value, date: latest.date, yoy, history: chart };
  });

  const dgs10Hist = histories[SERIES.findIndex((s) => s.id === "DGS10")] ?? [];
  const tenYearChart = dgs10Hist.slice(-90);
  const dgs10Latest = dgs10Hist[dgs10Hist.length - 1];
  const latestYield = dgs10Latest ? `${dgs10Latest.value}%` : "—";

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
          Tap any indicator to see its year-over-year change and history.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {econ.map((s) => (
            <EconCard key={s.id} s={s} />
          ))}
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
          <YieldChart data={tenYearChart} />
        </div>
      </section>
    </main>
  );
}
