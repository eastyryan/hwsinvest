import CareerList, { type Career } from "@/components/CareerList";

export const metadata = { title: "Careers · HWS Investment Club" };

const advisors = [
  {
    name: "Brandi Ferrara",
    initials: "BF",
    title: "Assistant Vice President, Career Services",
    bio: "Brandi has led the Salisbury Center for Career, Professional & Experiential Education since 1999, overseeing career development across every field and guiding students through graduate-school planning. She holds degrees from Johnson & Wales University.",
  },
  {
    name: "Shayne Feinberg",
    initials: "SF",
    title: "Director, Employer Development & Engagement",
    bio: "Shayne builds internship and job opportunities in for-profit fields including finance, real estate, sales, and marketing. Through info sessions and career treks, she connects students directly with employers and real-world examples of what these careers look like.",
  },
];

const careers: Career[] = [
  {
    title: "Investment Banking",
    blurb: "M&A and capital raising",
    detail:
      "Advise companies on mergers, acquisitions, and raising money through stock or debt. Analysts spend most of their time building financial models and putting together pitch books. It's the most common first job for people who want to end up in private equity or at a hedge fund — long hours, but you learn fast.",
    skills: "Excel modeling, accounting, valuation, stamina.",
    timeline: "Recruiting starts early — sophomore/junior year for summer analyst roles.",
  },
  {
    title: "Sales & Trading",
    blurb: "Markets desk",
    detail:
      "Work on a trading floor making markets and executing trades for clients across stocks, bonds, currencies, and credit. Sales covers the clients; trading manages the risk. Fast-paced and very markets-driven — good if you'd rather follow the tape than build models all night.",
    skills: "Quick mental math, market intuition, communication, composure.",
    timeline: "Spring-week and summer internships; junior-year recruiting.",
  },
  {
    title: "Equity Research",
    blurb: "Covering stocks",
    detail:
      "Analyze companies and industries, then publish written notes with earnings models and buy/sell/hold ratings. You become the go-to expert on a handful of stocks. A great path if you like digging into businesses and writing about them.",
    skills: "Writing, modeling, sector curiosity, attention to detail.",
    timeline: "On-cycle and off-cycle; networking matters a lot.",
  },
  {
    title: "Asset & Wealth Management",
    blurb: "Managing portfolios",
    detail:
      "Build and manage investment portfolios — either for big institutions (asset management) or for individuals and families (wealth management). The work is more about long-term strategy and client relationships than the deal-by-deal grind of banking.",
    skills: "Portfolio theory, client relationships, discipline.",
    timeline: "Rotational programs; the CFA is highly valued here.",
  },
  {
    title: "Private Equity",
    blurb: "Buying companies",
    detail:
      "Invest in private companies — source deals, underwrite them, and work to grow the businesses you buy before selling them later. Almost always a move you make after a couple of years in banking or consulting, though a few analyst programs exist.",
    skills: "Modeling, judgment, deal sense.",
    timeline: "Usually a post-banking move.",
  },
  {
    title: "Venture Capital",
    blurb: "Funding startups",
    detail:
      "Invest in early-stage startups and help them grow. The job is part finding promising founders, part evaluating markets, and part supporting the companies you back. Less about spreadsheets than PE — more about judgment, networks, and conviction.",
    skills: "Market sense, networking, pattern recognition.",
    timeline: "Hard to break into straight out of school; networking is everything.",
  },
  {
    title: "Hedge Funds",
    blurb: "Active investing",
    detail:
      "Funds that take active positions in markets to generate returns regardless of where the market goes. Strategies range from fundamental stock-picking to fully quantitative. Roles are competitive and often come after research, banking, or a strong quant background.",
    skills: "Analytical edge, conviction, risk awareness.",
    timeline: "Typically after a first job; some analyst seats exist.",
  },
  {
    title: "Corporate Finance / FP&A",
    blurb: "Finance inside a company",
    detail:
      "Run budgeting, forecasting, and capital decisions from inside a company rather than at a bank. Financial Planning & Analysis (FP&A) teams help leadership decide where the money goes. One of the most accessible and well-balanced entry points in finance.",
    skills: "Modeling, business partnering, communication.",
    timeline: "Rotational analyst programs; a great first job.",
  },
  {
    title: "Commercial & Corporate Banking",
    blurb: "Lending to businesses",
    detail:
      "Lend to and manage relationships with businesses — everything from local companies to large corporations. You assess credit risk and structure loans. More predictable hours than investment banking, and a solid foundation in how companies actually use money.",
    skills: "Credit analysis, relationship management, judgment.",
    timeline: "Structured analyst and training programs.",
  },
  {
    title: "Consulting",
    blurb: "Advising companies",
    detail:
      "Not strictly finance, but a huge destination for finance-minded grads. Help companies solve strategy and operations problems across industries. The exit options are wide — including private equity and corporate roles — which is part of the appeal.",
    skills: "Problem solving, communication, structured thinking.",
    timeline: "On-campus recruiting; junior-year internships.",
  },
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
          <h1 className="h-page">Where finance can take you</h1>
          <p className="lede" style={{ maxWidth: 620 }}>
            These are the paths HWS grads most often head into. Start with the
            college&apos;s own career office, then read up on the roles that
            interest you.
          </p>

          {/* First thing on the page: link to HWS Career Services */}
          <a
            href="https://www.hws.edu/centers/career-services/default.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="card card-hover-orange lift"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 28,
              padding: "18px 22px",
              maxWidth: 560,
              textDecoration: "none",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 22,
                flexShrink: 0,
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 11,
                background: "var(--brandSolid)",
                color: "#fff",
              }}
            >
              ↗
            </span>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                HWS Career Services
              </span>
              <span style={{ display: "block", fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>
                Advising, resume help, alumni connections, and recruiting events.
              </span>
            </span>
          </a>

          {/* Club advisors */}
          <div style={{ marginTop: 36 }}>
            <p className="kicker" style={{ marginBottom: 14 }}>
              Our club advisors
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
                maxWidth: 760,
              }}
            >
              {advisors.map((a) => (
                <div key={a.name} className="card card-hover-orange" style={{ padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      aria-hidden
                      className="serif"
                      style={{
                        flexShrink: 0,
                        width: 46,
                        height: 46,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: "var(--brandSolid)",
                        color: "#fff",
                        fontSize: 17,
                        fontWeight: 500,
                      }}
                    >
                      {a.initials}
                    </span>
                    <span>
                      <span
                        className="serif"
                        style={{
                          display: "block",
                          fontSize: 19,
                          fontWeight: 500,
                          color: "var(--text)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {a.name}
                      </span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--orangeText)", fontWeight: 600, marginTop: 2 }}>
                        {a.title}
                      </span>
                    </span>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "14px 0 0" }}>
                    {a.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Career list */}
      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <h2 className="h-section" style={{ marginBottom: 6 }}>
          Common career paths
        </h2>
        <p className="lede" style={{ maxWidth: 600, marginBottom: 26 }}>
          Tap any role to see what the job actually looks like, the skills it
          rewards, and when recruiting tends to happen.
        </p>

        <CareerList careers={careers} />

        {/* How the club fits in */}
        <div
          className="card"
          style={{
            marginTop: 28,
            padding: "clamp(22px,4vw,34px)",
            borderRadius: 14,
          }}
        >
          <h3 className="h-sub" style={{ marginBottom: 12 }}>
            How the club helps
          </h3>
          <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: "68ch" }}>
            We run weekly markets recaps and stock pitches so you can talk
            confidently about the market in an interview. We hold Excel and
            modeling workshops, do resume reviews and mock interviews before
            recruiting season, and lean on alumni and Career Services to make
            connections. You don&apos;t need a finance background to start —
            just show up.
          </p>
        </div>
      </section>
    </main>
  );
}
