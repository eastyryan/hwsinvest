import MissionJoin, { Spacer } from "@/components/MissionJoin";
import { board } from "@/data/board";

export const metadata = { title: "About · HWS Investment Club" };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AboutPage() {
  return (
    <main>
      <section className="container-x" style={{ paddingTop: "clamp(48px,7vh,84px)" }}>
        {/* About us */}
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--wsGreen)", fontSize: 14, fontWeight: 700, margin: 0 }}>
            About us
          </p>
          <h1 className="h-page">Who we are</h1>
          <p style={{ color: "var(--text)", fontSize: "16.5px", lineHeight: 1.7, margin: "16px auto 0", maxWidth: 680 }}>
            The HWS Investment Club brings together students from every major to
            learn how markets work, manage a paper portfolio, and prepare for
            careers in finance.
          </p>
        </div>

        <Spacer />

        <MissionJoin />

        <Spacer />

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--wsGreen)", fontSize: 14, fontWeight: 700, margin: 0 }}>
            Our team
          </p>
          <h2 className="h-section" style={{ marginTop: 6 }}>
            Meet the board
          </h2>
          <p style={{ color: "var(--text)", fontSize: "16.5px", lineHeight: 1.7, margin: "14px auto 0", maxWidth: 680 }}>
            The students leading the club this year.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "clamp(36px,4vw,52px)",
            marginTop: "clamp(32px,5vh,48px)",
          }}
        >
          {board.map((m) => (
            <div key={m.name + m.role} style={{ textAlign: "center" }}>
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.img}
                  alt={m.name}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 16,
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    background: "var(--wsGreen)",
                    color: "#fff",
                    fontSize: "clamp(44px,8vw,64px)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                  }}
                >
                  {initials(m.name)}
                </div>
              )}
              <p style={{ fontWeight: 700, color: "var(--text)", fontSize: 20, margin: "18px 0 0", letterSpacing: "-0.02em" }}>
                {m.name}
              </p>
              <p style={{ color: "var(--wsGreen)", fontSize: 15, margin: "4px 0 0", fontWeight: 700 }}>
                {m.role}
              </p>
              <p style={{ color: "var(--faint)", fontSize: 13.5, margin: "3px 0 0" }}>
                {m.focus ? `${m.focus} · ${m.year}` : m.year}
              </p>
              {m.bio && (
                <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, margin: "12px 0 0" }}>
                  {m.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
