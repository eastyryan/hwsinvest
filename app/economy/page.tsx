import SectionHeading from "@/components/SectionHeading";
import YieldChart from "@/components/YieldChart";
import { getLatest, getHistory } from "@/lib/fred";

export const metadata = { title: "Economy · HWS Investment Club" };
export const dynamic = "force-dynamic";

const SERIES = [
  { id: "DGS2", label: "2-Year Treasury", unit: "%" },
  { id: "DGS10", label: "10-Year Treasury", unit: "%" },
  { id: "DGS30", label: "30-Year Treasury", unit: "%" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
  { id: "UNRATE", label: "Unemployment", unit: "%" },
  { id: "CPIAUCSL", label: "CPI (Index)", unit: "" },
];

export default async function EconomyPage() {
  const [stats, history] = await Promise.all([
    Promise.all(SERIES.map((s) => getLatest(s.id))),
    getHistory("DGS10", 90),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <SectionHeading
        kicker="Economy"
        title="Bonds, rates & the economy"
        sub="Authoritative data from the Federal Reserve Bank of St. Louis (FRED). Treasury yields update each business day."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {SERIES.map((s, i) => {
          const d = stats[i];
          const label = SERIES[i].label;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-line bg-panel p-5"
            >
              <p className="text-sm text-gray-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white nums">
                {d ? `${d.value}${s.unit}` : "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {d ? `as of ${d.date}` : "no data"} · {s.id}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <SectionHeading
          title="10-Year Treasury yield"
          sub="The benchmark rate that influences mortgages, corporate borrowing, and equity valuations. Last ~90 observations."
        />
        <YieldChart data={history} />
      </div>
    </main>
  );
}
