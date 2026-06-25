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

        <h2 className="h-sub" style={{ margin: "48px 0 0" }}>
          Meet the board
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 22,
          }}
        >
          {board.map((m) => (
            <div
              key={m.name + m.role}
              className="card"
              style={{ padding: 26, textAlign: "center" }}
            >
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.img}
                  alt={m.name}
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: "50%",
                    objectFit: "cover",
                    margin: "0 auto",
                    display: "block",
                    border: "2px solid var(--brand)",
                  }}
                />
              ) : (
                <div
                  className="serif"
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: "50%",
                    background: "var(--brandSolid)",
                    color: "var(--yellow)",
                    fontSize: 27,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    border: "2px solid var(--brand)",
                  }}
                >
                  {initials(m.name)}
                </div>
              )}
              <p style={{ fontWeight: 600, color: "var(--text)", fontSize: 16, margin: "16px 0 0" }}>
                {m.name}
              </p>
              <p style={{ color: "var(--orangeText)", fontSize: 14, margin: "4px 0 0", fontWeight: 500 }}>
                {m.role}
              </p>
              <p className="mono" style={{ color: "var(--faint)", fontSize: "12.5px", margin: "4px 0 0" }}>
                {m.year}
              </p>
              {m.bio && (
                <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: "12px 0 0" }}>
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
