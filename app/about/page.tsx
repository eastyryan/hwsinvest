import SectionHeading from "@/components/SectionHeading";
import { Linkedin } from "lucide-react";
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
    <main className="mx-auto max-w-7xl px-6 py-12">
      <SectionHeading
        kicker="About us"
        title="Who we are"
        sub="The HWS Investment Club brings together students from every major to learn how markets work, manage a paper portfolio, and prepare for careers in finance."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-panel p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white">Our mission</h3>
          <p className="mt-2 text-sm text-gray-300">
            We make finance approachable and hands-on. Members research
            companies, debate ideas, manage a simulated portfolio, and build the
            skills and network to land internships and full-time roles. No prior
            experience required — just curiosity about markets.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-6">
          <h3 className="text-lg font-semibold text-white">Join us</h3>
          <p className="mt-2 text-sm text-gray-300">
            Meetings are open to all HWS students. Come to a meeting or reach out
            to any board member to get on the list.
          </p>
          <p className="mt-3 text-sm text-hws-yellow">Hobart and William Smith Colleges · Geneva, NY</p>
        </div>
      </div>

      <div className="mt-14">
        <SectionHeading title="Meet the board" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {board.map((m) => (
            <div
              key={m.name + m.role}
              className="rounded-xl border border-line bg-panel p-6 text-center"
            >
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.img}
                  alt={m.name}
                  className="mx-auto h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-hws-purple text-2xl font-semibold text-hws-yellow">
                  {initials(m.name)}
                </div>
              )}
              <p className="mt-4 font-semibold text-white">{m.name}</p>
              <p className="text-sm text-hws-orange">{m.role}</p>
              <p className="text-xs text-gray-500">{m.year}</p>
              {m.bio && <p className="mt-2 text-xs text-gray-400">{m.bio}</p>}
              {m.linkedin && (
                <a
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-gray-400 transition hover:text-hws-yellow"
                >
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-gray-500">
          Edit the roster in <code>data/board.ts</code> and drop photos into{" "}
          <code>/public/board/</code>.
        </p>
      </div>
    </main>
  );
}
