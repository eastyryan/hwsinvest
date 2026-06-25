import Link from "next/link";
import Ticker from "@/components/Ticker";
import IndexCard from "@/components/IndexCard";
import { getQuotes } from "@/lib/finnhub";
import { indices, sectors } from "@/data/sectors";
import { usd, pct, isUp, arrow } from "@/lib/format";

// Edit this watchlist to whatever the club wants to track.
const WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM"];

export const metadata = { title: "Markets · HWS Investment Club" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [indexQuotes, sectorQuotes, watchQuotes] = await Promise.all([
    getQuotes(indices.map((i) => i.symbol)),
    getQuotes(sectors.map((s) => s.etf)),
    getQuotes(WATCHLIST),
  ]);

  return (
    <main>
      {/* Page header */}
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <p className="kicker">Markets</p>
          <h1 className="h-page">U.S. equity markets</h1>
          <p className="lede">
            Live quotes via index-tracking and sector ETFs, plus the names the
            club is actively researching.
          </p>
        </div>
      </section>

      <Ticker topBorder={false} />

      {/* Major indices */}
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
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
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
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

      {/* Watchlist */}
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <h2 className="h-sub">The club watchlist</h2>
        <p className="lede" style={{ maxWidth: 560, margin: "11px 0 18px" }}>
          The names we&rsquo;re actively researching and pitching this semester.
        </p>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--card)",
          }}
        >
          <div
            className="mono"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
              padding: "13px 22px",
              background: "var(--card2)",
              borderBottom: "1px solid var(--line)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--faint)",
            }}
          >
            <span>Symbol</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>Change</span>
            <span style={{ textAlign: "right" }}>% Change</span>
          </div>
          {watchQuotes.map((q) => {
            const up = isUp(q.dp);
            const color = up ? "var(--up)" : "var(--down)";
            return (
              <div
                key={q.symbol}
                className="row-hover"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                  padding: "14px 22px",
                  borderBottom: "1px solid var(--lineSoft)",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>
                  {q.symbol}
                </span>
                <span className="mono nums" style={{ textAlign: "right", color: "var(--text)", fontSize: 14 }}>
                  {usd(q.c)}
                </span>
                <span className="mono nums" style={{ textAlign: "right", color, fontSize: 14 }}>
                  {q.d >= 0 ? "+" : ""}
                  {q.d?.toFixed(2)}
                </span>
                <span className="mono nums" style={{ textAlign: "right", color, fontSize: 14 }}>
                  {pct(q.dp)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
