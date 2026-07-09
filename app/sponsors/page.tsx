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
    <main>
      {/* ---------------- Hero card ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(24px,4vh,40px)" }}>
        <div
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
              backgroundImage: "url('/melly-hero.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,16,0.55)" }} />
          <h1
            style={{
              position: "relative",
              color: "#fff",
              fontWeight: 700,
              fontSize: "clamp(34px,6vw,64px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              margin: 0,
              textAlign: "center",
              padding: "0 20px",
            }}
          >
            The Melly Institute
          </h1>
        </div>
      </section>

      {/* ---------------- Intro ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "clamp(24px,4vw,44px)",
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

      {/* ---------------- Stat band (full-width orange) ---------------- */}
      <section
        style={{
          marginTop: "clamp(48px,7vh,84px)",
          background: "var(--orange)",
          padding: "clamp(44px,6vh,72px) 0",
        }}
      >
        <div className="container-x">
          <div className="stat-grid stat-grid-orange">
            {stats.map((s) => (
              <div key={s.label} className="stat-item" style={{ padding: "clamp(18px,2.5vw,28px)", textAlign: "center" }}>
                <p style={{ fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
                  {s.value}
                </p>
                <p style={{ fontWeight: 700, fontSize: 15, color: "#fff", margin: "8px 0 0" }}>{s.label}</p>
                <p style={{ fontSize: 13.5, color: "#fdf4ec", lineHeight: 1.5, margin: "6px auto 0", maxWidth: "26ch" }}>
                  {s.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- What the gift funds ---------------- */}
      <section className="container-x" style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <h2
          className="heading-nowrap"
          style={{
            fontWeight: 700,
            fontSize: "clamp(24px,3.4vw,42px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: "0 auto 26px",
            color: "var(--text)",
            textAlign: "center",
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

    </main>
  );
}
