/** Public logo URLs, fetched by our own route so the page CSP can stay same-origin. */

export function logoTicker(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/\./g, "-")
    .replace(/[^A-Z0-9-]/g, "");
}

export function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const raw = website.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    const domain = host.replace(/^www\./i, "").toLowerCase();
    return domain.includes(".") ? domain : null;
  } catch {
    return null;
  }
}

/** Ticker logos first. A site favicon is only used when the filing profile has a website. */
export function companyLogoSources(ticker: string, website?: string | null): string[] {
  const sources: string[] = [];
  const symbol = logoTicker(ticker);
  if (symbol) {
    const encoded = encodeURIComponent(symbol);
    sources.push(`https://assets.parqet.com/logos/symbol/${encoded}`);
    sources.push(`https://financialmodelingprep.com/image-stock/${encoded}.png`);
  }
  const domain = websiteDomain(website);
  if (domain) {
    sources.push(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
    );
  }
  return sources;
}

/** Year from a company description. Null when the text never states one. */
export function foundedYearFromDescription(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(
    /\b(?:founded|incorporated|established|organized)\s+(?:in\s+)?(1[7-9]\d{2}|20\d{2})\b/i
  );
  if (!match) return null;
  const year = Number(match[1]);
  const now = new Date().getFullYear();
  return year >= 1600 && year <= now ? year : null;
}
