export const metadata = { title: "Sponsors · HWS Investment Club" };

const stats = [
  { value: "$70M", label: "Founding gift", note: "from L. Thomas Melly ’52 & Judith Hershey Melly" },
  { value: "Guaranteed", label: "Funded internships", note: "every student, with funding to make it possible" },
  { value: "NYC · Boston", label: "Career treks", note: "to Wall Street and Boston financial firms" },
];

const support = [
  {
    title: "Bloomberg Terminals",
    body: "The same terminals used on trading floors — for pulling live market data, building equity research, and managing real money the way professionals do.",
  },
  {
    title: "Financial modeling & valuation",
    body: "Industry-designed certification courses in financial modeling, valuation, and data literacy that earn digital badges for LinkedIn and résumés.",
  },
  {
    title: "A guaranteed internship program",
    body: "Funded internships so a summer in finance is possible regardless of a student’s background — the experience that turns into a full-time offer.",
  },
  {
    title: "Professionals-in-Residence",
    body: "Wall Street leaders brought to campus to coach students, share how the industry really works, and open doors that are hard to open alone.",
  },
  {
    title: "Career treks to the Street",
    body: "Visits to financial institutions in New York and Boston, plus an alumni network that reaches desks at firms like Goldman Sachs and J.P. Morgan.",
  },
  {
    title: "A home for finance clubs",
    body: "Support for the Finance Society and Investment Management Group — where students analyze markets, compete nationally, and manage real funds.",
  },
];

export default function SponsorsPage() {
  return (
    <main className="container-x" style={{ paddingTop: "clamp(24px,4vh,40px)" }}>
      {/* ---------------- Hero card ---------------- */}
      <section
        style={{
          position: "relative",
          borderRadius: 22,
          overflow: "hidden",
          minHeight: "clamp(260px,40vh,380px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
            backgroundPosition: "center 45%",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,16,0.55)" }} />
        <div style={{ position: "relative", textAlign: "center", padding: "0 20px" }}>
          <h1
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: "clamp(34px,6vw,64px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            The Melly Institute
          </h1>
        </div>
      </section>

      {/* ---------------- Intro ---------------- */}
      <section style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(26px,3.6vw,40px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.18,
            margin: 0,
            maxWidth: "22ch",
            color: "var(--text)",
          }}
        >
          The HWS Investment Club is proud to be sponsored by the Melly Institute for Business,
          Innovation and Leadership.
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "clamp(24px,4vw,44px)",
            marginTop: "clamp(24px,4vh,36px)",
          }}
        >
          <p style={{ flex: "1 1 340px", color: "var(--muted)", fontSize: 16.5, lineHeight: 1.7, margin: 0 }}>
            The Institute was founded through a transformative $70 million gift from{" "}
            <strong style={{ color: "var(--text)" }}>L. Thomas Melly ’52</strong>, an HWS alumnus
            and Wall Street icon, and his wife{" "}
            <strong style={{ color: "var(--text)" }}>Judith Hershey Melly</strong>. Their gift was
            built to prepare a new generation of HWS students for careers in finance and business —
            giving them the tools, the experience, and the connections that used to be reserved for
            students at much larger schools. For our members, that support is what turns interest in
            the markets into a real path onto Wall Street.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/melly-couple.webp"
            alt="L. Thomas Melly ’52 and Judith Hershey Melly"
            style={{
              flex: "1 1 360px",
              width: "100%",
              maxWidth: 480,
              borderRadius: 16,
              border: "1px solid var(--wsGreen)",
              display: "block",
            }}
          />
        </div>
      </section>

      {/* ---------------- Stat band ---------------- */}
      <section style={{ paddingTop: "clamp(40px,6vh,64px)" }}>
        <div
          className="stat-grid stat-grid-green"
          style={{
            border: "1px solid var(--wsGreen)",
            borderRadius: 18,
            overflow: "hidden",
            background: "var(--card)",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} className="stat-item" style={{ padding: "clamp(22px,3vw,32px)", textAlign: "center" }}>
              <p style={{ fontWeight: 700, fontSize: "clamp(28px,4vw,42px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
                {s.value}
              </p>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "8px 0 0" }}>{s.label}</p>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: "6px auto 0", maxWidth: "26ch" }}>
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- What the gift funds ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <h2
          className="heading-nowrap"
          style={{
            fontWeight: 700,
            fontSize: "clamp(24px,3.4vw,42px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: "0 0 26px",
            color: "var(--text)",
          }}
        >
          What the gift puts in students’ hands
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {support.map((s) => (
            <div key={s.title} className="card" style={{ padding: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18.5, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
                {s.title}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, margin: "10px 0 0" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- What it means for the club ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <div
          style={{
            borderRadius: 22,
            background: "var(--wsGreen)",
            padding: "clamp(34px,6vw,64px)",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "rgba(255,255,255,0.82)" }}>
            What it means for the club
          </p>
          <h2
            style={{
              fontWeight: 700,
              fontSize: "clamp(26px,4vw,42px)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              margin: "12px auto 0",
              maxWidth: "22ch",
            }}
          >
            More than a name behind us
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, margin: "16px auto 0", maxWidth: 640, color: "rgba(255,255,255,0.9)" }}>
            The Institute’s support lets the Investment Club do more than meet and talk markets. It
            means members can build on Bloomberg Terminals, earn modeling and valuation
            certifications, take funded internships, and meet the professionals and alumni who
            actually hire. It levels the playing field — a small-college club with the tools,
            training, and network of a much bigger one.
          </p>
          <a
            href="https://www.hws.edu/centers/melly-institute/default.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ marginTop: "clamp(22px,3vh,30px)", padding: "12px 22px", fontSize: 15 }}
          >
            Visit the Melly Institute →
          </a>
        </div>
      </section>
    </main>
  );
}
