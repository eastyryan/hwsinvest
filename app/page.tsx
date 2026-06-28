import Link from "next/link";
import Ticker from "@/components/Ticker";
import Logo from "@/components/Logo";
import FirmLogo from "@/components/FirmLogo";
import { firms } from "@/data/club";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      {/* ---------------- Hero ---------------- */}
      <section
        style={{
          position: "relative",
          minHeight: "clamp(560px, 82vh, 820px)",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background: "var(--bgDeep)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "#0c0a14" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/CoxeHall.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "74% 42%",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,16,0.5)" }} />

        <div
          className="container-x"
          style={{
            position: "relative",
            width: "100%",
            textAlign: "center",
            paddingTop: "clamp(48px, 7vh, 90px)",
            paddingBottom: "clamp(48px, 7vh, 90px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ marginBottom: 26 }}>
            <Logo size={78} />
          </div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "clamp(30px, 5vw, 58px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: 0,
            }}
          >
            <span className="heading-nowrap">Hobart &amp; William Smith Colleges</span>
            <br />
            Investment Club
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 34,
              justifyContent: "center",
            }}
          >
            <Link href="/markets" className="btn-ghost" style={{ fontSize: 16, padding: "15px 26px" }}>
              Explore the Markets
            </Link>
            <Link href="/about" className="btn-ghost" style={{ fontSize: 16, padding: "15px 26px" }}>
              Meet the Board
            </Link>
          </div>
        </div>
      </section>

      <Ticker />

      {/* ---------------- Intro paragraphs ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "clamp(28px,5vw,56px)",
            maxWidth: 920,
            margin: "0 auto",
          }}
        >
          <div>
            <div style={statValue}>55+</div>
            <div style={statSub}>Members</div>
            <p style={statPara}>
              Drawn from every major — economics and finance to the sciences and
              humanities — and growing every semester. No prior background required.
            </p>
          </div>
          <div>
            <div style={statValue}>Tuesdays</div>
            <div style={statSub}>7:00 – 8:00 PM</div>
            <p style={statPara}>
              Open to every HWS student. Come to a single meeting, bring a friend,
              and see if it&rsquo;s for you — no experience needed.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Who we are (full-width orange band) ---------------- */}
      <section
        style={{
          marginTop: "clamp(56px,8vh,96px)",
          background: "var(--orange)",
          padding: "clamp(64px,10vh,116px) 0",
        }}
      >
        <div className="container-x" style={{ maxWidth: 940, margin: "0 auto", textAlign: "center" }}>
          <h2
            className="serif"
            style={{
              color: "#fdf4ec",
              fontWeight: 500,
              fontSize: "clamp(34px,5vw,54px)",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Who We Are
          </h2>
          <p
            className="serif"
            style={{
              color: "#fdf4ec",
              fontSize: "clamp(17px,1.55vw,21px)",
              lineHeight: 1.75,
              maxWidth: 720,
              margin: "clamp(20px,3vh,30px) auto 0",
            }}
          >
            The HWS Investment Club brings together students from every major to
            learn how markets actually work. We focus on fundamental, bottom-up
            research — studying real companies, debating ideas in the open, and
            testing a thesis against a live, simulated portfolio. No prior
            experience is required: whether you&rsquo;re aiming for Wall Street or
            just want to understand the news, there&rsquo;s a place for you here.
          </p>
          <Link
            href="/about"
            className="serif"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: "clamp(24px,3.5vh,36px)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 17,
              textDecoration: "none",
              borderBottom: "1px solid rgba(255,255,255,0.55)",
              paddingBottom: 2,
            }}
          >
            More about us <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ---------------- Where it leads (firms) ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
          <p className="kicker">Placements</p>
          <h2 className="h-section">Where our members land</h2>
          <p className="lede" style={{ margin: "13px auto 0" }}>
            Club members and alumni have gone on to firms across investment
            banking, asset management, markets, and more.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "clamp(40px,5vw,56px) clamp(24px,3vw,40px)",
            marginTop: "clamp(36px,5vw,56px)",
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          {firms.map((f) => (
            <FirmLogo key={f.name} name={f.name} logo={f.logo} />
          ))}
        </div>
        <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 16, fontStyle: "italic", margin: "clamp(28px,4vw,44px) 0 0" }}>
          and more …
        </p>
      </section>

    </main>
  );
}

const statValue: React.CSSProperties = {
  fontSize: "clamp(46px,6.5vw,68px)",
  fontWeight: 600,
  color: "var(--orange)",
  lineHeight: 1,
  letterSpacing: "-0.015em",
};
const statSub: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginTop: 10,
};
const statPara: React.CSSProperties = {
  fontSize: "clamp(16px,1.4vw,18px)",
  lineHeight: 1.7,
  color: "var(--muted)",
  margin: "16px 0 0",
};
