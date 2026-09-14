import Link from "next/link";
import { notFound } from "next/navigation";
import { ISSUES, issueBySlug } from "@/data/newsletters";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return ISSUES.map((i) => ({ slug: i.slug }));
}

export function generateMetadata({ params }: Params) {
  const issue = issueBySlug(params.slug);
  return {
    title: issue ? `${issue.title} · Newsletter` : "Newsletter · HWS Investment Club",
  };
}

export default function IssuePage({ params }: Params) {
  const issue = issueBySlug(params.slug);
  if (!issue) notFound();

  return (
    <main style={{ padding: "clamp(24px,4vh,40px) 0 64px" }}>
      <div className="container-x" style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <p className="kicker">
              Newsletter · Issue {String(issue.no).padStart(2, "0")}
            </p>
            <h1 className="h-sub" style={{ fontSize: "clamp(22px,3vw,30px)", marginTop: 6 }}>
              {issue.title}
            </h1>
            <p className="mono" style={{ fontSize: 12, color: "var(--faint)", margin: "6px 0 0", letterSpacing: "0.06em" }}>
              {issue.week}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={issue.file} target="_blank" rel="noreferrer" className="ctl">
              Open in new tab
            </a>
            <Link href="/members/newsletter" className="ctl">
              ← All issues
            </Link>
          </div>
        </div>
      </div>

      {/* The issue is a complete standalone document with its own type scale
          and scripts, so it renders in a frame rather than being inlined. */}
      <div className="container-x" style={{ maxWidth: 1160, margin: "0 auto" }}>
        <iframe
          src={issue.file}
          title={`Issue ${issue.no}: ${issue.title}`}
          loading="lazy"
          style={{
            width: "100%",
            height: "min(1400px, calc(100vh - 40px))",
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "#faf9f5",
            marginTop: 18,
          }}
        />
      </div>
    </main>
  );
}
