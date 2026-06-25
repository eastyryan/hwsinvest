import Link from "next/link";
import Ticker from "@/components/Ticker";
import IndexCard from "@/components/IndexCard";
import MissionJoin from "@/components/MissionJoin";
import { getQuotes } from "@/lib/finnhub";
import { indices } from "@/data/sectors";

// Render at request time so quotes are fresh and the build doesn't depend on
// env vars being present.
export const dynamic = "force-dynamic";

const tiles = [
  { tag: "MK", href: "/markets", title: "Markets", desc: "Indices, sector tiles, and our club watchlist." },
  { tag: "EC", href: "/economy", title: "Economy", desc: "Treasury yields, the Fed, inflation, and jobs." },
  { tag: "CA", href: "/careers", title: "Careers", desc: "Finance paths and how to break into them." },
  { tag: "AB", href: "/about", title: "About", desc: "Our mission, the board, and how to join." },
];

export default async function Home() {
  const quotes = await getQuotes(indices.map((i) => i.symbol));

  return (
    <main>
      {/* ---------------- Hero ---------------- */}
      <section
        style={{
          position: "relative",
          minHeight: "clamp(580px, 84vh, 860px)",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          background: "var(--bgDeep)",
        }}
      >
        {/* Campus photo — drop a real image at /public/campus.jpg.
            A themed gradient shows through until then. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "var(--heroFallback), url('/campus.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "74% 42%",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "var(--heroScrim)" }} />
        <div style={{ position: "absolute", inset: 0, background: "var(--heroVignette)" }} />
        <div
          className="container-x"
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "clamp(64px, 9vh, 112px)",
          }}
        >
          <h1
            className="serif"
            style={{
              fontWeight: 500,
              fontSize: "clamp(42px, 7vw, 84px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: "#fff",
              margin: "14px 0 0",
              maxWidth: "13ch",
            }}
          >
            The HWS{" "}
            <span style={{ fontStyle: "italic", color: "var(--orange)" }}>
              Investment Club
            </span>
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: "clamp(16px, 2vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 520,
              margin: "22px 0 0",
            }}
          >
            Live markets, hands-on research, and the career knowledge to take you
            from the Quad to Wall Street — built by students, for students.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 34 }}>
            <Link
              href="/markets"
              className="btn-primary"
              style={{
                fontSize: 16,
                padding: "15px 24px",
                boxShadow: "0px 12px 30px -10px #9c22e899",
              }}
            >
              Explore the Markets <span style={{ fontSize: 18 }}>→</span>
            </Link>
            <Link
              href="/about"
              className="btn-ghost"
              style={{ fontSize: 16, padding: "15px 24px" }}
            >
              Meet the Board
            </Link>
          </div>
        </div>
      </section>

      <Ticker />

      {/* ---------------- About ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <p className="kicker">About us</p>
        <h2 className="h-section">Who we are</h2>
        <p className="lede" style={{ maxWidth: 600 }}>
          The HWS Investment Club brings together students from every major to
          learn how markets work, manage a paper portfolio, and prepare for
          careers in finance.
        </p>
        <div style={{ marginTop: 34 }}>
          <MissionJoin showCta />
        </div>
      </section>

      {/* ---------------- Explore tiles ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,90px)" }}>
        <p className="kicker">Dive in</p>
        <h2 className="h-section">Where do you want to go?</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginTop: 30,
          }}
        >
          {tiles.map((t) => (
            <Link
              key={t.tag}
              href={t.href}
              className="card card-hover-orange lift"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 24,
                textDecoration: "none",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  width: 38,
                  height: 38,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 9,
                  letterSpacing: "0.04em",
                  background: "#419c66",
                }}
              >
                {t.tag}
              </span>
              <h3
                className="serif"
                style={{
                  fontWeight: 500,
                  fontSize: 22,
                  color: "var(--text)",
                  margin: "18px 0 0",
                  letterSpacing: "-0.01em",
                }}
              >
                {t.title}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55, margin: "8px 0 0" }}>
                {t.desc}
              </p>
              <span
                style={{
                  marginTop: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: "#419c66",
                }}
              >
                Open <span style={{ fontSize: 15 }}>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Indices ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,90px)" }}>
        <p className="kicker">At a glance</p>
        <h2 className="h-section">Major U.S. indices</h2>
        <p className="lede" style={{ maxWidth: 560 }}>
          A live snapshot via index-tracking ETFs, updated continuously during
          market hours.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
            marginTop: 32,
          }}
        >
          {quotes.map((q) => {
            const label = indices.find((i) => i.symbol === q.symbol)?.label;
            return <IndexCard key={q.symbol} quote={q} label={label} etf={q.symbol} />;
          })}
        </div>
      </section>
    </main>
  );
}
