import Link from "next/link";
import Ticker from "@/components/Ticker";
import Logo from "@/components/Logo";
import FirmLogo from "@/components/FirmLogo";
import { clubStats, firms, meeting } from "@/data/club";

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
        <div style={{ position: "absolute", inset: 0, background: "var(--heroFallback)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/CoxeHall.jpg')",
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
          <p
            className="mono"
            style={{
              color: "var(--yellow)",
              fontSize: "12.5px",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Hobart and William Smith Colleges
          </p>
          <h1
            className="serif"
            style={{
              fontWeight: 500,
              fontSize: "clamp(40px, 7vw, 80px)",
              lineHeight: 1.0,
              letterSpacing: "-0.025em",
              color: "#fff",
              margin: "18px 0 0",
              maxWidth: "16ch",
            }}
          >
            The HWS{" "}
            <span style={{ fontStyle: "italic", color: "var(--orange)" }}>
              Investment Club
            </span>
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "clamp(16px, 2vw, 20px)",
              lineHeight: 1.6,
              maxWidth: 620,
              margin: "22px auto 0",
            }}
          >
            A fully student-run club where members learn the markets through
            hands-on research, weekly stock pitches, and a bottom-up approach to
            investing — from the Quad to Wall Street.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 34,
              justifyContent: "center",
            }}
          >
            <Link
              href="/markets"
              className="btn-primary"
              style={{ fontSize: 16, padding: "15px 26px", boxShadow: "0px 12px 30px -10px #9c22e899" }}
            >
              Explore the Markets <span style={{ fontSize: 18 }}>→</span>
            </Link>
            <Link href="/about" className="btn-ghost" style={{ fontSize: 16, padding: "15px 26px" }}>
              Meet the Board
            </Link>
          </div>
        </div>
      </section>

      <Ticker />

      {/* ---------------- Stat band ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {clubStats.map((s) => (
            <div
              key={s.label}
              className="card"
              style={{ padding: "30px 26px", textAlign: "center" }}
            >
              <p
                className="serif"
                style={{
                  fontSize: "clamp(34px,5vw,48px)",
                  fontWeight: 500,
                  color: "var(--orange)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </p>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "10px 0 0" }}>
                {s.label}
              </p>
              <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "4px 0 0" }}>
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Who are we ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "clamp(28px,5vw,64px)",
            alignItems: "center",
          }}
        >
          <div>
            <p className="kicker">Who we are</p>
            <h2 className="h-section" style={{ maxWidth: "14ch" }}>
              A student-run approach to the markets
            </h2>
          </div>
          <div>
            <p style={{ color: "var(--muted)", fontSize: 16.5, lineHeight: 1.7, margin: 0 }}>
              The HWS Investment Club brings together students from every major to
              learn how markets actually work. We focus on fundamental, bottom-up
              research — studying real companies, debating ideas in the open, and
              testing a thesis against a live, simulated portfolio.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 16.5, lineHeight: 1.7, margin: "16px 0 0" }}>
              No prior experience is required. Whether you&rsquo;re aiming for Wall
              Street or just want to understand the news, there&rsquo;s a place for
              you here.
            </p>
            <Link
              href="/about"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 22,
                color: "var(--orangeText)",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              More about us <span style={{ fontSize: 17 }}>→</span>
            </Link>
          </div>
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
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginTop: 34,
          }}
        >
          {firms.map((f) => (
            <div
              key={f.name}
              className="card"
              style={{
                padding: "20px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 78,
              }}
            >
              <FirmLogo name={f.name} logo={f.logo} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Meetings / Join ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <div
          style={{
            background: "var(--missionBg)",
            border: "1px solid var(--missionBorder)",
            borderRadius: 20,
            padding: "clamp(30px,5vw,56px)",
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: 540 }}>
            <p style={{ color: "var(--missionMark)", fontSize: "12.5px", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, margin: 0, fontFamily: "var(--font-mono), monospace" }}>
              Join us
            </p>
            <h2
              className="serif"
              style={{
                fontWeight: 500,
                fontSize: "clamp(28px,4vw,42px)",
                color: "var(--missionHead)",
                margin: "12px 0 0",
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              Meetings every {meeting.day} at {meeting.time}
            </h2>
            <p style={{ color: "var(--missionText)", fontSize: 16.5, lineHeight: 1.65, margin: "16px 0 0" }}>
              {meeting.blurb} Come to one — bring a friend — and see if it&rsquo;s
              for you.
            </p>
          </div>
          <Link
            href="/about"
            className="btn-primary"
            style={{ fontSize: 16, padding: "16px 28px", flexShrink: 0 }}
          >
            Get involved <span style={{ fontSize: 18 }}>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
