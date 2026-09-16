# HWS Investment Club

A professional markets dashboard for the Hobart and William Smith Colleges Investment Club. Live equities/indices via **Finnhub**, Treasury yields and economic data via **FRED**, built with **Next.js (App Router)** + **Tailwind CSS**, deployed on **Vercel**.

## Pages

- `/`: Landing: campus hero, live indices, navigation tiles
- `/markets`: Indices, sector tiles, club watchlist
- `/markets/[sector]`: Sector ETF + representative holdings
- `/economy`: Treasury yields, Fed funds, CPI, unemployment + 10Y yield chart
- `/careers`: Finance career paths and how the club prepares you
- `/about`: Mission and board showcase
- `/members`: Password-gated dashboard (learn tracks, files, research, newsletter)
- `/members/newsletter`: The club newsletter, every issue, newest first
- `/members/research`: Company research tool (synced from the finance app): SEC statements, ratios, ownership, segments, valuation suite, screener, watchlist, Excel export
- `/admin`: Admin-only club console: calendar, email list, newsletter, file uploads

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

### Environment variables

Create `.env.local` (git-ignored, never commit real keys):

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
| Weekly meeting time and term dates | `data/calendar.ts` |
| Required trainings and other board-only dates | `data/calendar-board.ts` |
| Newsletter issues | `data/newsletters.ts` + the HTML in `public/newsletters/` |

## The admin console

`/admin` needs the `ADMIN_PASSWORD` login and holds these sections:

- **Calendar**: the standing Tuesday 7:30 PM meeting, the college's required
  Club Training and Title IX Training sessions, and anything else the board
  adds. Exports to `.ics` for Google/Apple/Outlook. The schedule that ships in
  code is split in two: `data/calendar.ts` holds the standing meeting (edit
  `TERMS` each semester, `WEEKLY` if the meeting moves, `SESSION_OVERRIDES`
  for per-night titles and agendas, `WEEKLY_SKIP` for breaks), and
  `data/calendar-board.ts` holds `FIXED_EVENTS`, the dates the college hands
  down. The split is deliberate: members only ever see the standing meeting, so
  only `/admin` imports the board module and the training dates never reach a
  member's JavaScript bundle. Keep board-only dates in the board file.
- **Email list**: names and school emails, with copy buttons for pasting into a
  mail client (use Bcc for anything club-wide) and a bulk paste importer.
- **Attendance**: paste or upload each week's Google Form CSV. Names are matched
  to the email list (including common nicknames). Confirm the matches, save the
  meeting, and every roster member gets a running % (meetings attended ÷
  meetings tracked). Admin-only — members never see this tab. Optional
  `XAI_API_KEY` can help with unusual name spellings; it is not required.
- **Newsletter**: every published issue.
- **Files**: the Dropbox uploader that feeds `/members/files`.
- **Board files**: a private `_board/` Dropbox folder only visible with the
  admin password — budgets, officer notes, anything members should not see.

The email list, attendance meetings, and any events added from the console are
stored as one JSON document in the same Dropbox app folder the file area uses,
under `_club-data/club.json`. Board-only documents live under `_board/` and are
only reachable from the admin **Board files** tab (members get a 403 if they
craft a path into it). Both folders are filtered out of the members file
browser. Without Dropbox configured the console still works, but the data only
lives in that one browser and the header says so.

### Publishing a newsletter issue

1. Drop the issue's HTML into `public/newsletters/` (date-first filename).
2. Add a row at the top of `ISSUES` in `data/newsletters.ts`.

`/newsletters/*` is listed in the middleware matcher, so issue URLs are behind
the members login rather than public.

## Notes

- Index and sector values use ETFs (SPY, QQQ, DIA, XLK, …) since those work on Finnhub's free tier.
- Data is cached briefly (`revalidate`) to respect free-tier rate limits.
- For educational purposes only: not investment advice. Data may be delayed.
