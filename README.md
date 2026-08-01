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
| `engine/` | The proven Stableford maths + course data lifted from Conwy Choppers |
| `docs/BRIEF.md` | The decisions: positioning, pricing, roles, what's in and out |
| `docs/SETUP.md` | The accounts and keys Tom needs to open, in order |

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:3000
```

It runs **with no accounts, no keys and no network**. The whole product is
clickable today because `app/lib/store.ts` keeps everything in `localStorage`
and seeds two demo societies:

- **Conwy Choppers** — the real season, with real rounds, showing an Order of Merit
- **Weekend Dogs** — a 12-player golf day half-played, showing live scoring and the QR board

Try this path: home → Weekend Dogs → August Meeting → type a gross → **Open board**.
That last screen is what 24 golfers see when they scan the code.

"Reset demo data" at the bottom of the home page puts it all back.

## The one rule about the code

**No page talks to the database directly.** Everything goes through
`app/lib/store.ts`. Today that's localStorage; when Supabase is wired up, that
one file changes and nothing else does. The shapes in `app/lib/types.ts`
already match `supabase/schema.sql` column for column.

## Where it came from

Conwy Choppers (`github.com/tomwilliams92-hue/conwy-choppers`) is the working
prototype this is generalised from — one hardcoded society becomes many. Three
things carried over intact:

- **The Stableford conversion**, verified against a real Wales Golf round:
  `36 + CourseHandicap + Par − AdjustedGross`
- **The course database** — real CR / slope / par for Conwy, Bromborough,
  Wallasey, St Melyd and Abergele
- **The Wales Golf scraper**, which pulls official scores rather than trusting
  typed-in ones

## Not building

No community challenges, no national leaderboards, no gross/scratch rankings,
no paid-entry prize competitions. Societee is software for society organisers.
See `docs/BRIEF.md`.
