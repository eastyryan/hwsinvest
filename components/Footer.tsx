import Link from "next/link";
import Logo from "./Logo";

const exploreLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/economy", label: "Economy" },
  { href: "/careers", label: "Careers" },
  { href: "/about", label: "About" },
];

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: "clamp(56px, 8vh, 96px)",
        background: "var(--bgDeep)",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div
        className="container-x"
        style={{
          paddingTop: "clamp(40px,6vh,64px)",
          paddingBottom: "clamp(40px,6vh,64px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Logo size={32} />
              <span
                className="serif"
                style={{ fontSize: 19, fontWeight: 500, color: "var(--text)" }}
              >
                <span style={{ color: "var(--brand)" }}>HWS</span> Investment Club
              </span>
            </div>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "13.5px",
                lineHeight: 1.6,
                margin: "16px 0 0",
              }}
            >
              Built by students, for students. Live markets, hands-on research,
              and the path from the Quad to Wall Street.
            </p>
            <p
              style={{
                color: "var(--faint)",
                fontSize: 12,
                lineHeight: 1.5,
                margin: "14px 0 0",
              }}
            >
              For educational purposes only — not investment advice. Data may be
              delayed and is provided by Finnhub and FRED.
            </p>
          </div>

          <div
            style={{ display: "flex", gap: "clamp(32px,6vw,72px)", flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                  marginBottom: 2,
                }}
              >
                Explore
              </span>
              {exploreLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="link-muted"
                  style={{ fontSize: 14 }}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                  marginBottom: 2,
                }}
              >
                Colleges
              </span>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>
                Hobart College
              </span>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>
                William Smith College
              </span>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>
                Geneva, New York
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--line)",
            marginTop: 36,
            paddingTop: 22,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "var(--faint)", fontSize: "12.5px" }}>
            © {new Date().getFullYear()} HWS Investment Club
          </span>
          <span
            className="mono"
            style={{ color: "var(--faint)", fontSize: 12, letterSpacing: "0.04em" }}
          >
            Disce · Βιος — Ψυχή
          </span>
        </div>
      </div>
    </footer>
  );
}
