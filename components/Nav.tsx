import Link from "next/link";
import { TrendingUp } from "lucide-react";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/economy", label: "Economy" },
  { href: "/careers", label: "Careers" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded bg-hws-purple">
            <TrendingUp className="h-5 w-5 text-hws-yellow" />
          </span>
          <span className="text-white">
            HWS <span className="text-hws-orange">Investment Club</span>
          </span>
        </Link>
        <ul className="hidden items-center gap-8 text-sm text-gray-300 sm:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition hover:text-hws-yellow">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
