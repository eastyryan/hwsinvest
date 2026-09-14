import Link from "next/link";
import { ISSUES } from "@/data/newsletters";
import IssueList from "@/components/club/IssueList";

export const metadata = { title: "Newsletter · HWS Investment Club" };

export default function NewsletterIndexPage() {
  return (
    <main className="container-x" style={{ padding: "clamp(32px,5vh,56px) 0 80px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p className="kicker">Members</p>
          <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>The Newsletter</h1>
          <p className="lede" style={{ maxWidth: "52ch" }}>
            A weekly read on what moved and why it moved, written for people who are still learning the vocabulary.
            Every issue carries the tape, the charts, three stories worth your time, and a glossary you can click into.
          </p>
        </div>
        <Link href="/members" className="ctl">← Dashboard</Link>
      </div>

      <IssueList issues={ISSUES} />
    </main>
  );
}
