import { board } from "@/data/board";
import { contactEmail } from "@/data/club";
import ContactForm from "@/components/ContactForm";
import MemberCard from "@/components/MemberCard";

export const metadata = { title: "About · HWS Investment Club" };

export default function AboutPage() {
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
            backgroundImage: "url('/careers-hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 42%",
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
          About Us
        </h1>
      </section>

      {/* ---------------- Our Team ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <h2
          style={{
            fontWeight: 700,
            // Sized so the line fits the container in one row on desktop and
            // only wraps once the viewport gets narrow.
            fontSize: "clamp(26px,3.4vw,42px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: "18px 0 0",
            color: "var(--text)",
          }}
        >
          The students building the club this year
        </h2>

        <div
          style={{
            display: "grid",
            // 300px min keeps the board at a clean 3-up on desktop instead of
            // 4 + orphans; still collapses to 2 then 1.
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
            marginTop: "clamp(28px,4vh,44px)",
          }}
        >
          {board.filter((m) => !m.hidden).map((m) => (
            <MemberCard key={m.name + m.role} member={m} />
          ))}
        </div>
      </section>

      {/* ---------------- Letter from the president ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <span className="kicker" style={{ color: "var(--wsGreen)" }}>
          From the President
        </span>

        <blockquote
          style={{
            margin: "20px 0 0",
            color: "var(--text)",
            fontSize: "clamp(21px,2.9vw,34px)",
            lineHeight: 1.42,
            letterSpacing: "-0.018em",
            fontWeight: 500,
            // Hangs the opening quote in the gutter so the text edge stays
            // flush with everything else on the page.
            textIndent: "-0.42em",
          }}
        >
          &ldquo;I started coming to meetings because I wanted somewhere to argue
          about markets and learn from people who cared about them as much as I
          did, and I ended up running the club. We&rsquo;re students from every
          major, and most of us walked in without knowing what a DCF was, myself
          included. What we do is pretty simple: we pull companies apart, pitch
          them to each other, run a simulated portfolio together, and get things
          wrong in a room where that is allowed. This year I want more members
          pitching than we&rsquo;ve ever had, research good enough that anyone
          can check the numbers themselves, and an alumni network our members can
          actually call on when they&rsquo;re going after a first internship. If
          that sounds like your kind of thing, come to one meeting. You
          don&rsquo;t have to know anything yet.&rdquo;
        </blockquote>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: "clamp(26px,3.5vh,36px)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/board/easton.jpg"
            alt="Easton Ryan"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--line)",
            }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Easton Ryan
            </div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              President, Class of 2027
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" style={{ paddingTop: "clamp(56px,8vh,96px)", scrollMarginTop: 84 }}>
        <div
          style={{
            borderRadius: 22,
            background: "var(--wsGreen)",
            padding: "clamp(34px,6vw,64px)",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <h2
            style={{
              fontWeight: 700,
              fontSize: "clamp(26px,4vw,42px)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Contact us
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, margin: "14px 0 0", color: "rgba(255,255,255,0.9)" }}>
            Questions about joining, meetings, or the club? Send us a note and a
            board member will get back to you.
          </p>
          <ContactForm email={contactEmail} />
        </div>
      </section>
    </main>
  );
}
