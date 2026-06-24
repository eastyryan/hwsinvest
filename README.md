# HWS Investment Club

A professional markets dashboard for the Hobart and William Smith Colleges Investment Club. Live equities/indices via **Finnhub**, Treasury yields and economic data via **FRED**, built with **Next.js (App Router)** + **Tailwind CSS**, deployed on **Vercel**.

## Pages

- `/` — Landing: campus hero, live indices, navigation tiles
- `/markets` — Indices, sector tiles, club watchlist
- `/markets/[sector]` — Sector ETF + representative holdings
- `/economy` — Treasury yields, Fed funds, CPI, unemployment + 10Y yield chart
- `/careers` — Finance career paths and how the club prepares you
- `/about` — Mission and board showcase

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

### Environment variables

Create `.env.local` (git-ignored — never commit real keys):

```
FINNHUB_API_KEY=your_finnhub_key   # https://finnhub.io
FRED_API_KEY=your_fred_key         # https://fred.stlouisfed.org/docs/api/api_key.html
```

Both are read **only on the server** (no `NEXT_PUBLIC_` prefix), so they never reach the browser.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → import the repo**.
3. Under **Settings → Environment Variables**, add `FINNHUB_API_KEY` and `FRED_API_KEY` (Production + Preview + Development).
4. **Deploy.** Every push to `main` auto-deploys. Changing env vars requires a redeploy.

## Customizing

| What | Where |
| --- | --- |
| Campus hero photo | add `public/campus.jpg` |
| Board roster + photos | `data/board.ts` and `public/board/` |
| Watchlist tickers | `WATCHLIST` in `app/markets/page.tsx` |
| Sectors / holdings | `data/sectors.ts` |
| Colors / branding | `tailwind.config.ts` (`hws.purple`, `hws.orange`, `hws.yellow`) |
| Economic series | `SERIES` in `app/economy/page.tsx` |

## Notes

- Index and sector values use ETFs (SPY, QQQ, DIA, XLK, …) since those work on Finnhub's free tier.
- Data is cached briefly (`revalidate`) to respect free-tier rate limits.
- For educational purposes only — not investment advice. Data may be delayed.
