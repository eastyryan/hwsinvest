import Ticker from "@/components/Ticker";
import IndexCard from "@/components/IndexCard";
import SectorCard from "@/components/SectorCard";
import YieldChart from "@/components/YieldChart";
import EconCard, { type EconSeries } from "@/components/EconCard";
import { getQuotes } from "@/lib/finnhub";
import { getHistory } from "@/lib/fred";
import { indices, sectors } from "@/data/sectors";
import { yoyChange } from "@/lib/format";

import type { EconFmt } from "@/lib/format";

const SERIES: { id: string; label: string; fmt: EconFmt; note: string; desc: string }[] = [
  {
    id: "DGS2",
    label: "2-Year Treasury",
    fmt: "pct",
    note: "daily",
    desc: "The yield on a U.S. government bond maturing in two years. It closely tracks where investors expect the Fed to set short-term interest rates over the next couple of years.",
  },
  {
    id: "DGS10",
    label: "10-Year Treasury",
    fmt: "pct",
    note: "daily",
    desc: "The yield on the 10-year U.S. government bond — the benchmark 'risk-free' rate. It influences mortgage rates, corporate borrowing costs, and how stocks are valued.",
  },
  {
    id: "DGS30",
    label: "30-Year Treasury",
    fmt: "pct",
    note: "daily",
    desc: "The yield on the 30-year U.S. government bond. As the longest common maturity, it reflects the market's long-run expectations for growth and inflation.",
  },
  {
    id: "FEDFUNDS",
    label: "Fed Funds Rate",
    fmt: "pct",
    note: "monthly",
    desc: "The interest rate banks charge each other for overnight loans, steered into a target range by the Federal Reserve. It's the main lever of U.S. monetary policy and ripples into nearly every other rate.",
  },
  {
    id: "UNRATE",
    label: "Unemployment",
    fmt: "pct",
    note: "monthly",
    desc: "The share of the labor force that is without a job and actively looking for one. A core gauge of labor-market health — low is generally strong, but very low can signal an overheating economy.",
  },
  {
    id: "CPIAUCSL",
    label: "CPI (Index)",
    fmt: "index",
    note: "monthly",
    desc: "The Consumer Price Index tracks the average price of a basket of goods and services households buy. It's the most widely watched measure of inflation — rising values mean prices are climbing.",
  },
  {
    id: "GDPC1",
    label: "Real GDP",
    fmt: "gdp",
    note: "quarterly",
    desc: "Real Gross Domestic Product is the inflation-adjusted value of everything the U.S. economy produces. It's the broadest measure of economic output, so its growth rate defines expansions and recessions.",
  },
  {
    id: "PCEPILFE",
    label: "Core PCE (Index)",
    fmt: "index",
    note: "monthly",
    desc: "Core Personal Consumption Expenditures prices — inflation excluding volatile food and energy. This is the Federal Reserve's preferred inflation gauge for judging progress toward its 2% target.",
  },
  {
    id: "PAYEMS",
    label: "Nonfarm Payrolls",
    fmt: "payrolls",
    note: "monthly",
    desc: "The total number of paid U.S. workers outside of farming, private households, and the military. The monthly change is the headline 'jobs report' that markets react to strongly.",
  },
  {
    id: "UMCSENT",
    label: "Consumer Sentiment",
    fmt: "sentiment",
    note: "monthly",
    desc: "The University of Michigan's survey of how optimistic households feel about their finances and the economy. Since consumer spending drives most of GDP, it's a forward-looking read on demand.",
  },
  {
    id: "MORTGAGE30US",
    label: "30-Yr Mortgage",
    fmt: "pct",
    note: "weekly",
    desc: "The average interest rate on a 30-year fixed-rate home loan. It's a key driver of housing affordability — higher rates cool home demand, lower rates fuel it.",
  },
  {
    id: "T10Y2Y",
    label: "10Y–2Y Spread",
    fmt: "pct",
    note: "daily",
    desc: "The gap between 10-year and 2-year Treasury yields. When it turns negative (an 'inverted' curve), it has historically been one of the most reliable warning signals of a coming recession.",
  },
];

export const metadata = { title: "Markets · HWS Investment Club" };
export const dynamic = "force-dynamic";

const DAY = 24 * 3600 * 1000;

// Derive latest value, year-over-year change, and a downsampled chart series
// from a chronological FRED history.
function summarize(hist: { date: string; value: number }[], fmt: EconFmt) {
  if (!hist.length) return { value: null, date: null, yoy: null, history: [] as { date: string; value: number }[] };
  const latest = hist[hist.length - 1];
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
      ? yoyChange(latest.value, prior.value, fmt)
      : null;
  const step = Math.max(1, Math.floor(hist.length / 80));
  const chart = hist.filter((_, idx) => idx % step === 0);
  if (chart[chart.length - 1]?.date !== latest.date) chart.push(latest);
  return { value: latest.value, date: latest.date, yoy, history: chart };
}

export default async function MarketsPage() {
  const [indexQuotes, sectorQuotes, histories, idxHistories] = await Promise.all([
    getQuotes(indices.map((i) => i.symbol)),
    getQuotes(sectors.map((s) => s.etf)),
    Promise.all(SERIES.map((s) => getHistory(s.id, 800))),
    Promise.all(indices.map((i) => (i.fred ? getHistory(i.fred, 800) : Promise.resolve([])))),
  ]);

  const econ: EconSeries[] = SERIES.map((s, i) => ({ ...s, ...summarize(histories[i], s.fmt) }));

  // Per-index YoY + history (FRED), keyed by ETF symbol. Russell 2000 has none.
  const indexInfo: Record<string, { yoy: { text: string; up: boolean } | null; history: { date: string; value: number }[] }> = {};
  indices.forEach((i, idx) => {
    const sum = i.fred ? summarize(idxHistories[idx], "index") : { yoy: null, history: [] };
    indexInfo[i.symbol] = { yoy: sum.yoy, history: sum.history };
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
            const info = indexInfo[q.symbol];
            return (
              <IndexCard
                key={q.symbol}
                quote={q}
                label={label}
                etf={q.symbol}
                yoy={info?.yoy ?? null}
                history={info?.history ?? []}
              />
            );
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
            return <SectorCard key={s.slug} sector={s} quote={q} />;
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
