export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-gray-400">
        <p className="font-semibold text-white">HWS Investment Club</p>
        <p className="mt-1">Hobart and William Smith Colleges · Geneva, NY</p>
        <p className="mt-4 max-w-2xl text-xs text-gray-500">
          For educational purposes only. Nothing on this site is investment
          advice. Market data may be delayed and is provided by Finnhub and the
          Federal Reserve Bank of St. Louis (FRED).
        </p>
        <p className="mt-4 text-xs text-gray-600">
          © {new Date().getFullYear()} HWS Investment Club
        </p>
      </div>
    </footer>
  );
}
