export default function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-widest text-hws-orange">
          {kicker}
        </p>
      )}
      <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-2 max-w-2xl text-sm text-gray-400">{sub}</p>}
    </div>
  );
}
