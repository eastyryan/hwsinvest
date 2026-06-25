export default function SectionHeading({
  kicker,
  title,
  sub,
  level = "section",
}: {
  kicker?: string;
  title: string;
  sub?: string;
  level?: "page" | "section";
}) {
  return (
    <div>
      {kicker && <p className="kicker">{kicker}</p>}
      <h2 className={level === "page" ? "h-page" : "h-section"}>{title}</h2>
      {sub && (
        <p className="lede" style={{ maxWidth: 620 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
