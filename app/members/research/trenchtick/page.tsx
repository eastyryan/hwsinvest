import Link from "next/link";

export const metadata = {
  title: "TrenchTick · Research · HWS Investment Club",
  description: "The live TrenchTick research site, embedded for members.",
};

const TRENCHTICK_URL = "https://finance-dnrapp.vercel.app";

// The site nav is sticky at 68px plus a 1px border. The toolbar below is 44px.
// The iframe fills the rest of the viewport so the page itself does not scroll.
export default function TrenchTickPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 69px)",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <Link
            href="/members/research"
            style={{ fontSize: 14, color: "#52525b", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            ← Research home
          </Link>
          <h1
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 20,
              fontWeight: 600,
              color: "#4b2e83",
            }}
          >
            TrenchTick
          </h1>
        </div>
        <a
          href={TRENCHTICK_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: "#4b2e83", whiteSpace: "nowrap" }}
        >
          Open in new tab ↗
        </a>
      </div>
      <iframe
        src={TRENCHTICK_URL}
        title="TrenchTick"
        style={{ flex: 1, width: "100%", border: 0, display: "block" }}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
