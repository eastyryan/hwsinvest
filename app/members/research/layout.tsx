import CommandPalette from "@/components/research/CommandPalette";

export const metadata = {
  title: "Company Research · HWS Investment Club",
  description:
    "Search any US-listed company and read SEC filings: statements, ratios, ownership, valuation, and Excel export.",
};

// Light is the default; only a saved "dark" preference flips the class.
const themeScript = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
      <CommandPalette />
    </>
  );
}
