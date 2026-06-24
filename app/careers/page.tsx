import SectionHeading from "@/components/SectionHeading";
import {
  Building2,
  LineChart,
  Search,
  Wallet,
  Briefcase,
  Calculator,
} from "lucide-react";

export const metadata = { title: "Careers · HWS Investment Club" };

const paths = [
  {
    icon: Building2,
    title: "Investment Banking",
    day: "Advise companies on M&A and raising capital; build financial models and pitch books.",
    skills: "Excel modeling, accounting, valuation, stamina.",
    timeline: "Recruiting starts very early — sophomore/junior year for summer analyst roles.",
  },
  {
    icon: LineChart,
    title: "Sales & Trading",
    day: "Make markets and execute trades; cover clients across equities, rates, FX, and credit.",
    skills: "Quick math, market intuition, communication, composure.",
    timeline: "Spring-week and summer internships; junior-year recruiting.",
  },
  {
    icon: Search,
    title: "Equity Research",
    day: "Analyze companies and industries; publish notes and earnings models with buy/sell views.",
    skills: "Writing, modeling, sector curiosity, attention to detail.",
    timeline: "On-cycle and off-cycle; networking matters a lot.",
  },
  {
    icon: Wallet,
    title: "Asset / Wealth Management",
    day: "Build and manage portfolios for institutions or individuals against a mandate.",
    skills: "Portfolio theory, client relationships, discipline.",
    timeline: "Rotational programs; CFA is highly valued.",
  },
  {
    icon: Briefcase,
    title: "Private Equity / VC",
    day: "Invest in private companies; source deals, underwrite, and improve portfolio firms.",
    skills: "Modeling, judgment, deal sense — usually after banking/consulting.",
    timeline: "Often a post-banking move; some analyst programs exist.",
  },
  {
    icon: Calculator,
    title: "Corporate Finance / FP&A",
    day: "Run budgeting, forecasting, and capital decisions inside a company.",
    skills: "Modeling, business partnering, communication.",
    timeline: "Rotational analyst programs; great entry path.",
  },
];

export default function CareersPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <SectionHeading
        kicker="Careers"
        title="Finance career paths"
        sub="A map of where a finance background can take you, what each role does day-to-day, and how to prepare."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paths.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-line bg-panel p-6"
          >
            <p.icon className="h-7 w-7 text-hws-yellow" />
            <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-sm text-gray-300">{p.day}</p>
            <p className="mt-3 text-xs text-gray-400">
              <span className="font-semibold text-hws-orange">Skills:</span>{" "}
              {p.skills}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              <span className="font-semibold text-hws-orange">Timeline:</span>{" "}
              {p.timeline}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-line bg-panel p-6">
        <h3 className="text-lg font-semibold text-white">
          How the club helps you prepare
        </h3>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-300">
          <li>Weekly markets recaps and stock pitches to build fluency.</li>
          <li>Excel & financial-modeling workshops.</li>
          <li>Resume reviews and mock interviews before recruiting season.</li>
          <li>Alumni networking and treks; connections at HWS Career Services.</li>
        </ul>
        <p className="mt-4 text-sm text-gray-400">
          Visit{" "}
          <span className="text-hws-yellow">HWS Salisbury Center / Career Services</span>{" "}
          to connect these paths with on-campus resources.
        </p>
      </div>
    </main>
  );
}
