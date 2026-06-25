"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/careers", label: "Careers" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--navBg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="container-x"
        style={{
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Logo size={34} />
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--brand)" }}>HWS</span> Investment Club
          </span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(12px, 2vw, 28px)",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="link-muted"
              style={{
                fontSize: "14.5px",
                fontWeight: 500,
                color: isActive(l.href) ? "var(--text)" : "var(--muted)",
              }}
            >
              {l.label}
            </Link>
          ))}

          <ThemeToggle />

          <Link
            href="/about"
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: "#fbfaf9",
              fontWeight: 600,
              fontSize: 13,
              padding: "9px 16px",
              borderRadius: 9,
              textDecoration: "none",
              whiteSpace: "nowrap",
              background: "var(--brandSolid)",
            }}
          >
            Join the Club
          </Link>
        </div>
      </div>
    </nav>
  );
}
