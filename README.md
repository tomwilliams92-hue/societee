# Societee

**Run your golf society without the spreadsheets.**

Software for the person who *organises* the golf, not for every golfer. One
organiser pays; their players never sign up, never download anything, and watch
the day on a QR code at the first tee.

Started 1 August 2026.

---

## What's in here

| Path | What it is |
|---|---|
| `app/` | The product — Next.js 16, React 19, Tailwind 4 |
| `supabase/schema.sql` | The database. Run this in Supabase when the project exists |
| `docs/BRIEF.md` | The decisions: positioning, pricing, roles, what's in and out |
| `docs/MARKET.md` | Who else is doing this, what they charge, and the handicap wall |
| `docs/SETUP.md` | The accounts and keys Tom needs to open, in order |

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:3000
```

It runs **with no accounts, no keys and no network**. The whole product is
clickable today because `app/lib/store.ts` keeps everything in `localStorage`
and seeds two invented demo societies:

- **Fairway Wanderers** — five players, a summer Order of Merit
- **Saturday Swindle** — a twelve-player golf day half-played, showing live
  scoring and the QR board

Try this path: home → Saturday Swindle → August Meeting → type a gross →
**Open board**. That last screen is what the players see when they scan the code.

"Reset demo data" at the bottom of the home page puts it all back.

## The one rule about the code

**No page talks to the database directly.** Everything goes through
`app/lib/store.ts`. Today that's localStorage; when Supabase is wired up, that
one file changes and nothing else does. The shapes in `app/lib/types.ts`
already match `supabase/schema.sql` column for column.

## The maths

Two formulas underpin everything, in `app/lib/scoring.ts`:

```
Course Handicap = round( Index × Slope/113 + (CR − Par) )
Stableford      = 36 + PlayingHandicap + Par − AdjustedGross
```

Playing handicap is the course handicap times the event's allowance — 95% for
individual Stableford under WHS. Handicap indexes are stored as numbers with
**plus golfers negative** (+1.6 is `-1.6`); format them for display, never store
the string.

## Not building

No community challenges, no national leaderboards, no gross/scratch rankings,
no paid-entry prize competitions. Societee is software for society organisers.
See `docs/BRIEF.md`.
