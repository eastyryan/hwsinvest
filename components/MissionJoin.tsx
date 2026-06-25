import Link from "next/link";

const missionBullets: [string, string][] = [
  ["Pitch & debate", "weekly stock pitches and markets recaps build real fluency."],
  ["Manage a portfolio", "allocate across sectors and own the outcome."],
  ["Build the toolkit", "Excel and financial-modeling workshops every term."],
  ["Open the network", "alumni treks, mock interviews, and recruiting prep."],
];

const joinBullets: [string, string][] = [
  ["Drop in", "come to any weekly meeting, and bring a friend."],
  ["Get on the list", "recaps, events, and recruiting deadlines."],
  ["Pick a team", "join a sector group and start covering names."],
];

function Bullet({
  head,
  body,
  mark,
  headColor,
  textColor,
}: {
  head: string;
  body: string;
  mark: string;
  headColor: string;
  textColor: string;
}) {
  return (
    <li style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
      <span
        style={{
          flexShrink: 0,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: mark,
          marginTop: 8,
        }}
      />
      <span style={{ color: textColor, fontSize: "14.5px", lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600, color: headColor }}>{head}</strong> — {body}
      </span>
    </li>
  );
}

const panel = (bg: string, border: string): React.CSSProperties => ({
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: 18,
  padding: "clamp(26px,3.4vw,40px)",
  display: "flex",
  flexDirection: "column",
});

const cardKicker = (color: string): React.CSSProperties => ({
  fontFamily: "var(--font-mono), monospace",
  fontSize: "11.5px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color,
  fontWeight: 600,
  margin: 0,
});

export default function MissionJoin({ showCta = false }: { showCta?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 20,
        alignItems: "stretch",
      }}
    >
      {/* Mission — purple */}
      <div style={panel("var(--missionBg)", "var(--missionBorder)")}>
        <p style={cardKicker("var(--missionMark)")}>Our mission</p>
        <h3
          className="serif"
          style={{
            fontWeight: 500,
            fontSize: "clamp(26px,3vw,34px)",
            color: "var(--missionHead)",
            margin: "12px 0 0",
            letterSpacing: "-0.01em",
          }}
        >
          Make finance approachable — and hands-on
        </h3>
        <p
          style={{
            color: "var(--missionText)",
            fontSize: "15.5px",
            lineHeight: 1.65,
            margin: "16px 0 0",
          }}
        >
          We believe you learn markets by participating in them. No prior
          experience required — just curiosity. Members research real companies,
          debate ideas in the open, and put a thesis to the test against a live,
          simulated portfolio.
        </p>
        <div style={{ height: 1, background: "var(--missionBorder)", margin: "24px 0" }} />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          {missionBullets.map(([h, b]) => (
            <Bullet
              key={h}
              head={h}
              body={b}
              mark="var(--missionMark)"
              headColor="var(--missionHead)"
              textColor="var(--missionText)"
            />
          ))}
        </ul>
      </div>

      {/* Join — green */}
      <div style={panel("var(--joinBg)", "var(--joinBorder)")}>
        <p style={cardKicker("var(--joinMark)")}>Join us</p>
        <h3
          className="serif"
          style={{
            fontWeight: 500,
            fontSize: "clamp(26px,3vw,34px)",
            color: "var(--joinHead)",
            margin: "12px 0 0",
            letterSpacing: "-0.01em",
          }}
        >
          Everyone&rsquo;s first meeting is an open one
        </h3>
        <p
          style={{
            color: "var(--joinText)",
            fontSize: "15.5px",
            lineHeight: 1.65,
            margin: "16px 0 0",
          }}
        >
          Meetings are open to all HWS students — come once, no commitment, and
          see if it&rsquo;s for you. Here&rsquo;s how to get started.
        </p>
        <div style={{ height: 1, background: "var(--joinBorder)", margin: "24px 0" }} />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          {joinBullets.map(([h, b]) => (
            <Bullet
              key={h}
              head={h}
              body={b}
              mark="var(--joinMark)"
              headColor="var(--joinHead)"
              textColor="var(--joinText)"
            />
          ))}
        </ul>
        <div style={{ marginTop: "auto", paddingTop: 26 }}>
          {showCta && (
            <Link
              href="/about"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                color: "#f7f5f3",
                fontWeight: 600,
                fontSize: 15,
                padding: "13px 22px",
                borderRadius: 11,
                textDecoration: "none",
                background: "var(--joinMark)",
                border: "2px solid var(--joinMark)",
              }}
            >
              Reach out to the board <span style={{ fontSize: 17 }}>→</span>
            </Link>
          )}
          <p
            className="mono"
            style={{
              fontSize: "12.5px",
              color: "var(--joinMark)",
              margin: showCta ? "18px 0 0" : 0,
              letterSpacing: "0.04em",
            }}
          >
            Hobart and William Smith Colleges · Geneva, NY
          </p>
        </div>
      </div>
    </div>
  );
}
