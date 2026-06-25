import MissionJoin from "@/components/MissionJoin";
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
      {/* Page header */}
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <p className="kicker">About us</p>
          <h1 className="h-page">Who we are</h1>
          <p className="lede" style={{ maxWidth: 640 }}>
            The HWS Investment Club brings together students from every major to
            learn how markets work, manage a paper portfolio, and prepare for
            careers in finance.
          </p>
        </div>
      </section>

      <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
        <MissionJoin />

        <div style={{ margin: "clamp(56px,8vh,88px) 0 0", textAlign: "center" }}>
          <p className="kicker">Our team</p>
          <h2 className="h-section" style={{ marginTop: 6 }}>
            Meet the board
          </h2>
          <p className="lede" style={{ maxWidth: 560, margin: "13px auto 0" }}>
            The students leading the club this year.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "clamp(36px,4vw,52px)",
            marginTop: "clamp(36px,5vh,56px)",
            maxWidth: 880,
            marginLeft: "auto",
            marginRight: "auto",
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
                    background: "var(--brandSolid)",
                    color: "var(--yellow)",
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
              <p style={{ color: "var(--orangeText)", fontSize: 15, margin: "4px 0 0", fontWeight: 700 }}>
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
