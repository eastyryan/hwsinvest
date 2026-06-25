export const metadata = { title: "Careers · HWS Investment Club" };

const paths = [
  {
    n: "01",
    title: "Investment Banking",
    day: "Advise companies on M&A and raising capital; build financial models and pitch books.",
    skills: "Excel modeling, accounting, valuation, stamina.",
    timeline: "Recruiting starts very early — sophomore/junior year for summer analyst roles.",
  },
  {
    n: "02",
    title: "Sales & Trading",
    day: "Make markets and execute trades; cover clients across equities, rates, FX, and credit.",
    skills: "Quick math, market intuition, communication, composure.",
    timeline: "Spring-week and summer internships; junior-year recruiting.",
  },
  {
    n: "03",
    title: "Equity Research",
    day: "Analyze companies and industries; publish notes and earnings models with buy/sell views.",
    skills: "Writing, modeling, sector curiosity, attention to detail.",
    timeline: "On-cycle and off-cycle; networking matters a lot.",
  },
  {
    n: "04",
    title: "Asset / Wealth Management",
    day: "Build and manage portfolios for institutions or individuals against a mandate.",
    skills: "Portfolio theory, client relationships, discipline.",
    timeline: "Rotational programs; CFA is highly valued.",
  },
  {
    n: "05",
    title: "Private Equity / VC",
    day: "Invest in private companies; source deals, underwrite, and improve portfolio firms.",
    skills: "Modeling, judgment, deal sense — usually after banking/consulting.",
    timeline: "Often a post-banking move; some analyst programs exist.",
  },
  {
    n: "06",
    title: "Corporate Finance / FP&A",
    day: "Run budgeting, forecasting, and capital decisions inside a company.",
    skills: "Modeling, business partnering, communication.",
    timeline: "Rotational analyst programs; great entry path.",
  },
];

const prep = [
  "Weekly markets recaps and stock pitches to build fluency.",
  "Excel and financial-modeling workshops.",
  "Resume reviews and mock interviews before recruiting season.",
  "Alumni networking, treks, and connections at Career Services.",
];

export default function CareersPage() {
  return (
    <main>
      {/* Page header */}
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <p className="kicker">Careers</p>
          <h1 className="h-page">Finance career paths</h1>
          <p className="lede">
            A map of where a finance background can take you, what each role does
            day-to-day, and how to prepare.
          </p>
        </div>
      </section>

      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {paths.map((p) => (
            <div key={p.n} className="card card-hover-brand" style={{ padding: 24 }}>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--brandSolid)",
                  width: 38,
                  height: 38,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 9,
                }}
              >
                {p.n}
              </span>
              <h3
                className="serif"
                style={{
                  fontWeight: 500,
                  fontSize: 21,
                  color: "var(--text)",
                  margin: "18px 0 0",
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55, margin: "10px 0 0" }}>
                {p.day}
              </p>
              <p style={{ fontSize: "12.5px", color: "var(--faint)", margin: "14px 0 0", lineHeight: 1.5 }}>
                <span style={{ color: "var(--orangeText)", fontWeight: 600 }}>Skills · </span>
                {p.skills}
              </p>
              <p style={{ fontSize: "12.5px", color: "var(--faint)", margin: "7px 0 0", lineHeight: 1.5 }}>
                <span style={{ color: "var(--orangeText)", fontWeight: 600 }}>Timeline · </span>
                {p.timeline}
              </p>
            </div>
          ))}
        </div>

        {/* How the club prepares you */}
        <div
          className="card"
          style={{
            padding: "clamp(24px,4vw,36px)",
            borderRadius: 16,
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div>
            <h3
              className="serif"
              style={{ fontWeight: 500, fontSize: 24, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}
            >
              How the club prepares you
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>
              Connect these paths with on-campus resources at the HWS Salisbury
              Center for Career, Professional &amp; Experiential Education.
            </p>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {prep.map((item) => (
              <li
                key={item}
                style={{ display: "flex", gap: 11, color: "var(--text)", fontSize: "14.5px", lineHeight: 1.5 }}
              >
                <span style={{ color: "var(--orange)", fontWeight: 700 }}>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
