import { board } from "@/data/board";
import { contactEmail } from "@/data/club";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "About · HWS Investment Club" };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const principles = [
  {
    title: "Learn by doing",
    body: "Members research real companies, pitch ideas, and manage a live simulated portfolio — not just theory.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M19 9l-5 5-4-4-3 3" />
      </svg>
    ),
  },
  {
    title: "Open to everyone",
    body: "No finance background required, and every major is welcome. Come to one meeting and see if it's for you.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Built for careers",
    body: "Modeling workshops, mock interviews, and an alumni network that helps members land roles across finance.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
];

function LinkedInButton({ href }: { href?: string }) {
  return (
    <a
      href={href || "#"}
      target={href ? "_blank" : undefined}
      rel="noopener noreferrer"
      aria-label="LinkedIn profile"
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: 8,
        background: "var(--text)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--bg)">
        <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.06h4.56V24H.22V8.06zM8.34 8.06h4.37v2.18h.06c.61-1.16 2.1-2.38 4.32-2.38 4.62 0 5.47 3.04 5.47 6.99V24h-4.56v-7.05c0-1.68-.03-3.84-2.34-3.84-2.34 0-2.7 1.83-2.7 3.72V24H8.34V8.06z" />
      </svg>
    </a>
  );
}

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

      {/* ---------------- Principles ---------------- */}
      <section style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(26px,3.6vw,40px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.18,
            margin: "18px 0 0",
            maxWidth: "20ch",
            color: "var(--text)",
          }}
        >
          The HWS Investment Club runs on one idea:{" "}
          <span style={{ color: "var(--muted)" }}>
            you learn the markets by being in them.
          </span>{" "}
          No experience needed — just curiosity.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: "clamp(28px,4vh,44px)",
          }}
        >
          {principles.map((p) => (
            <div
              key={p.title}
              className="card"
              style={{ padding: 24, display: "flex", flexDirection: "column" }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 11,
                  background: "var(--wsGreen)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.icon}
              </span>
              <h3 style={{ fontWeight: 700, fontSize: 19, color: "var(--text)", margin: "44px 0 0", letterSpacing: "-0.01em" }}>
                {p.title}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, margin: "10px 0 0" }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Our Team ---------------- */}
      <section style={{ paddingTop: "clamp(56px,8vh,96px)" }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(28px,4vw,46px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.12,
            margin: "18px 0 0",
            maxWidth: "16ch",
            color: "var(--text)",
          }}
        >
          The students building the club this year
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginTop: "clamp(28px,4vh,44px)",
          }}
        >
          {board.map((m) => (
            <div
              key={m.name + m.role}
              style={{
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                aspectRatio: "4 / 5",
                background: "var(--card2)",
              }}
            >
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.img}
                  alt={m.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "var(--wsGreen)",
                    color: "#fff",
                    fontSize: "clamp(44px,7vw,64px)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {initials(m.name)}
                </div>
              )}

              {/* Floating name/title label */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 12,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
                    {m.name}
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>
                    {m.role}
                  </p>
                </div>
                <LinkedInButton href={m.linkedin || undefined} />
              </div>
            </div>
          ))}
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
          <p style={{ fontSize: 16.5, lineHeight: 1.6, margin: "14px auto 0", maxWidth: 560, color: "rgba(255,255,255,0.9)" }}>
            Questions about joining, meetings, or the club? Send us a note and a
            board member will get back to you.
          </p>
          <ContactForm email={contactEmail} />
        </div>
      </section>
    </main>
  );
}
