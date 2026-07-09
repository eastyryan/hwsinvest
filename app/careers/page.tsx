import CareerList, { type Career } from "@/components/CareerList";
import AdvisorCard, { type Advisor } from "@/components/AdvisorCard";

export const metadata = { title: "Careers · HWS Investment Club" };

const advisors: Advisor[] = [
  {
    name: "Brandi Ferrara",
    initials: "BF",
    title: "Assistant Vice President, Career Services",
    img: "/advisors/brandi.jpg",
    bio: "Brandi has led the Salisbury Center for Career, Professional & Experiential Education since 1999, overseeing career development across every field and guiding students through graduate-school planning. She holds degrees from Johnson & Wales University.",
  },
  {
    name: "Shayne Feinberg",
    initials: "SF",
    title: "Director, Employer Development & Engagement",
    img: "/advisors/shayne.jpg",
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
    timeline: "Recruiting runs 9–12 months ahead: you apply and interview in sophomore spring (roughly Nov–Mar) for the following summer. Full-time analyst recruiting then begins in junior fall.",
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
    timeline: "Asset-management applications open in junior fall (Aug–Dec) with interviews into early winter. Wealth management hires closer to year-round, with a key July–September window. The CFA (Level I) is highly valued.",
  },
  {
    title: "Private Equity",
    blurb: "Buying companies",
    detail:
      "Invest in private companies — source deals, underwrite them, and work to grow the businesses you buy before selling them later. Almost always a move you make after a couple of years in banking or consulting, though a few analyst programs exist.",
    skills: "Modeling, judgment, deal sense.",
    timeline: "Almost always a post-banking move — most people enter after 2+ years in investment banking or consulting. Direct undergrad hiring is rare and rolling (fall–spring) at smaller firms.",
  },
  {
    title: "Venture Capital",
    blurb: "Funding startups",
    detail:
      "Invest in early-stage startups and help them grow. The job is part finding promising founders, part evaluating markets, and part supporting the companies you back. Less about spreadsheets than PE — more about judgment, networks, and conviction.",
    skills: "Market sense, networking, pattern recognition.",
    timeline: "More open to undergrads than PE — part-time roles appear in the fall, scout/analyst spots peak in winter–spring, and full-time roles post fall–winter at smaller firms. Networking is everything.",
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
    timeline: "Early fall (Aug–Oct) is the primary window for summer internships, with interviews through the fall and offers by early winter. Rotational analyst programs make a great first job.",
  },
  {
    title: "Commercial & Corporate Banking",
    blurb: "Lending to businesses",
    detail:
      "Lend to and manage relationships with businesses — everything from local companies to large corporations. You assess credit risk and structure loans. More predictable hours than investment banking, and a solid foundation in how companies actually use money.",
    skills: "Credit analysis, relationship management, judgment.",
    timeline: "Summer-internship applications open in junior fall (Aug–Oct), with interviews and offers between November and January. Many full-time seats are filled by returning interns.",
  },
  {
    title: "Consulting",
    blurb: "Advising companies",
    detail:
      "Not strictly finance, but a huge destination for finance-minded grads. Help companies solve strategy and operations problems across industries. The exit options are wide — including private equity and corporate roles — which is part of the appeal.",
    skills: "Problem solving, communication, structured thinking.",
    timeline: "Applications open late summer–early fall (Aug–Oct) for the following summer, with rolling interviews Sept–Nov and many offers extended before winter break.",
  },
];

export default function CareersPage() {
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
            backgroundImage: "url('/about-hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 38%",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,16,0.5)" }} />
        <h1
          style={{
            position: "relative",
            color: "#fff",
            fontWeight: 700,
            fontSize: "clamp(40px,7vw,76px)",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          Careers
        </h1>
      </section>

      {/* ---------------- Career paths ---------------- */}
      <section style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <h2
          className="heading-nowrap"
          style={{
            fontWeight: 700,
            fontSize: "clamp(28px,4vw,46px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Where finance can take you
        </h2>
        <div style={{ marginTop: 26 }}>
          <CareerList careers={careers} />
        </div>
      </section>

      {/* ---------------- Advisors + Career Services ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)", textAlign: "center" }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(28px,4vw,46px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: 0,
            color: "var(--text)",
          }}
        >
          The people in your corner
        </h2>
        <p style={{ color: "var(--text)", fontSize: 16, lineHeight: 1.65, margin: "14px auto 0" }}>
          Our club advisors from Career Services. Hit the + to read more about each of them.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 20,
            marginTop: "clamp(28px,4vh,44px)",
          }}
        >
          {advisors.map((a) => (
            <div key={a.name} style={{ width: "min(320px, 100%)", textAlign: "left" }}>
              <AdvisorCard advisor={a} />
            </div>
          ))}
        </div>

        <p style={{ color: "var(--text)", fontSize: 15.5, lineHeight: 1.65, margin: "clamp(24px,4vh,36px) auto 0" }}>
          Want advising, resume help, or recruiting events?{" "}
          <a
            href="https://careerservices.hws.edu"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text)", fontWeight: 700, textDecoration: "underline" }}
          >
            Click here to visit the HWS Career Services website.
          </a>
        </p>

        <a
          href="https://careerservices.hws.edu/channels/finance/"
          target="_blank"
          rel="noopener noreferrer"
          className="card card-hover-brand"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "18px 20px",
            margin: "clamp(24px,4vh,36px) auto 0",
            maxWidth: 620,
            textAlign: "left",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 11,
              background: "var(--brandSolid)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M19 9l-5 5-4-4-3 3" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              HWS Career Services — Finance
            </span>
            <span style={{ display: "block", fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 }}>
              Explore every finance path, recruiting timelines, and resources on the official Career Services finance page.
            </span>
          </span>
          <span aria-hidden="true" style={{ flexShrink: 0, color: "var(--brand)", fontWeight: 700, fontSize: 20 }}>→</span>
        </a>
      </section>

      {/* ---------------- How the club helps ---------------- */}
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
            How the club helps
          </p>
          <h2
            style={{
              fontWeight: 700,
              fontSize: "clamp(26px,4vw,42px)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              margin: "12px auto 0",
              maxWidth: "20ch",
            }}
          >
            We help you get there
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, margin: "16px auto 0", maxWidth: 620, color: "rgba(255,255,255,0.9)" }}>
            Weekly markets recaps and stock pitches so you can talk confidently in
            an interview, Excel and modeling workshops, resume reviews and mock
            interviews before recruiting season, and alumni connections through
            Career Services. No finance background required — just show up.
          </p>
        </div>
      </section>
    </main>
  );
}
