"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/careers", label: "Careers" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/about", label: "About" },
  { href: "/members", label: "Members" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          style={{ display: "flex", alignItems: "center", gap: 13, textDecoration: "none", flexShrink: 0 }}
        >
          <Logo size={34} />
          <span
            className="nav-brand-text"
            style={{ fontSize: 19, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}
          >
            HWS Investment Club
          </span>
        </Link>

        {/* Desktop links */}
        <div className="nav-desktop">
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

          <Link
            href="/about#contact"
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

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`nav-mobile-menu${open ? " open" : ""}`}
        style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}
      >
        <div className="container-x" style={{ padding: "10px 0 18px", display: "flex", flexDirection: "column" }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "13px 4px",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                color: isActive(l.href) ? "var(--text)" : "var(--muted)",
                borderBottom: "1px solid var(--lineSoft)",
              }}
            >
              {l.label}
            </Link>
          ))}

          <Link
            href="/about#contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
              color: "#fbfaf9",
              fontWeight: 600,
              fontSize: 15,
              padding: "13px 16px",
              borderRadius: 10,
              textDecoration: "none",
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
