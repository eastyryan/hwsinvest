import Link from "next/link";
import { notFound } from "next/navigation";
import { publicIssues, publicIssueBySlug, issueNo } from "@/lib/newsletter-public";
import IssueBody, { SANS } from "@/components/newsletter/IssueBody";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicIssues().map((i) => ({ slug: i.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const issue = publicIssueBySlug(params.slug);
  if (!issue) return { title: "Newsletter · HWS Investment Club" };
  return {
    title: `Issue ${issueNo(issue.no)}: ${issue.title} · HWS Investment Club`,
    description: issue.summary,
  };
}

export default function NewsletterIssuePage({ params }: { params: { slug: string } }) {
  const issue = publicIssueBySlug(params.slug);
  if (!issue) notFound();

  return (
    <main className="container-x" style={{ padding: "clamp(28px,4vh,48px) 0 40px", maxWidth: 760, margin: "0 auto" }}>
      <Link href="/newsletter" style={{ fontFamily: SANS, fontSize: 14, color: "var(--brand)" }}>All issues</Link>
      <IssueBody issue={issue} />
    </main>
  );
}
