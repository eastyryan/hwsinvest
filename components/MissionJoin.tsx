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

// Long, centered William Smith green divider used to break sections.
export function Spacer() {
  return (
    <div
      style={{
        width: "min(260px, 70%)",
        height: 3,
        borderRadius: 2,
        background: "var(--wsGreen)",
        margin: "clamp(40px,6vh,64px) auto",
      }}
    />
  );
}

function Bullet({ head, body }: { head: string; body: string }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--wsGreen)",
          alignSelf: "center",
        }}
      />
      <span style={{ color: "var(--text)", fontSize: "15.5px", lineHeight: 1.6 }}>
        <strong style={{ fontWeight: 700 }}>{head}</strong> — {body}
      </span>
    </li>
  );
}

function Section({
  kicker,
  heading,
  children,
}: {
  kicker: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ color: "var(--wsGreen)", fontSize: 14, fontWeight: 700, margin: 0 }}>
        {kicker}
      </p>
      <h3
        style={{
          fontWeight: 700,
          fontSize: "clamp(26px,3.4vw,38px)",
          color: "var(--text)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          margin: "10px auto 0",
          maxWidth: "20ch",
        }}
      >
        {heading}
      </h3>
      {children}
    </div>
  );
}

export default function MissionJoin({ showCta = false }: { showCta?: boolean }) {
  return (
    <div>
      {/* Mission */}
      <Section kicker="Our mission" heading="Make finance approachable — and hands-on">
        <p style={{ color: "var(--text)", fontSize: "16.5px", lineHeight: 1.7, margin: "16px auto 0", maxWidth: 680 }}>
          We believe you learn markets by participating in them. No prior
          experience required — just curiosity. Members research real companies,
          debate ideas in the open, and put a thesis to the test against a live,
          simulated portfolio.
        </p>
        <ul style={{ margin: "22px auto 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13, maxWidth: 620 }}>
          {missionBullets.map(([h, b]) => (
            <Bullet key={h} head={h} body={b} />
          ))}
        </ul>
      </Section>

      <Spacer />

      {/* Join */}
      <Section kicker="Join us" heading="Everyone's first meeting is an open one">
        <p style={{ color: "var(--text)", fontSize: "16.5px", lineHeight: 1.7, margin: "16px auto 0", maxWidth: 680 }}>
          Meetings are open to all HWS students — come once, no commitment, and
          see if it&rsquo;s for you. Here&rsquo;s how to get started.
        </p>
        <ul style={{ margin: "22px auto 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13, maxWidth: 620 }}>
          {joinBullets.map(([h, b]) => (
            <Bullet key={h} head={h} body={b} />
          ))}
        </ul>
        {showCta && (
          <div style={{ marginTop: 26 }}>
            <Link href="/about" className="btn-primary" style={{ fontSize: 15, padding: "13px 24px" }}>
              Reach out to the board <span style={{ fontSize: 17 }}>→</span>
            </Link>
          </div>
        )}
        <p style={{ fontSize: "13.5px", color: "var(--faint)", margin: "18px 0 0" }}>
          Hobart and William Smith Colleges · Geneva, NY
        </p>
      </Section>
    </div>
  );
}
