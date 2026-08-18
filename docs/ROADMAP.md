# Societee — the to-do list

Kept honest on 5 Aug 2026. Feature-by-feature evidence lives in
[SQUABBIT-AUDIT.md](SQUABBIT-AUDIT.md); this file is the order of work.

## Now — the database (WIRED 6 Aug 2026, v18)

**Tom's two remaining dashboard steps** (sync won't fully work until both):

- [ ] SQL Editor → paste `supabase/upgrade1.sql` → Run (hole cards, community
      course policies, self-registration RPCs — event sync FAILS until this runs)
- [ ] Authentication → Sign In / Providers → Email → turn OFF "Confirm email"
      (instant account creation; otherwise every sign-up waits on an email link)

**Done in the wiring session:**

- [x] Project created, schema + courses seeded, key wired (`app/.env.local`)
- [x] Store swap: Supabase with offline cache + queued retry (`lib/supabase/sync.ts`)
- [x] Organiser sign-in — email + password on the Profile tab
- [x] Self-registration — wizard toggle live, `/register` page, server-frozen PH
- [x] Guest QR paths cross-phone: board + group scorer via token RPCs
- [x] One-tap migration of a device's existing data (Profile → Account)
- [x] Fixed: share QR links missing the GitHub Pages base path (pointed at 404s)
- [ ] Scorecard markers — attest / unofficial / discrepancy (next up)
- [ ] E2E live test once the two dashboard steps are done

## Next — riding on the database

- [ ] **Push notifications** — "off the 10th in 20 minutes", "board finalised".
      PWA web push + a Supabase edge function. *Needs the DB: notifying other
      people's phones means storing their push subscriptions centrally.*
- [ ] Real invites (email / link)
- [ ] Community course cards — every card one society enters is on file for the next

## Then — in rough order of value

- [ ] Stats package: streaks, blow-ups, league stats (the "worth paying for" feature)
- [ ] Skins and matchplay scoring (the two formats societies actually ask for)
- [ ] Tee sheet with times; full shotgun scheduling (groups + start holes exist)
- [ ] Print scorecards / cart signs / CSV export
- [ ] Team formats / flights — after real-user feedback, not before

## Deliberately not building (documented reasons in the audit)

- Per-player accounts (their duplicate-account mess) — players are rows, profiles claim rows
- Social feed / photos — WhatsApp does this
- GPS / shot tracking / Apple Watch — different product
- Payments / purses — FCA safeguarding territory
- AI settings assistant — their settings need a search box; ours has no settings screen

## Done (for the record)

- [x] Five-step Squabbit event wizard (name → formats → rounds → course → players) — v11
- [x] Per-round dates, non-consecutive — v12
- [x] Every UK course searchable (2,909, ODbL) + verified-cards messaging — v11/12
- [x] App-shell scroll: static tab bar, no Safari toolbar dance — v13
- [x] Zero horizontal overflow, 320–430px, every page and modal — v13/v17
- [x] Organiser score entry hole by hole (editable card, per-hole points) — v14
- [x] Create screen: event / season / society, one page, colour-coded — v15
- [x] Standalone safe-areas (status bar / home indicator) on every screen — v16
- [x] Tee colour dots; add tees to verified courses — v16
- [x] Add a brand-new player inside the wizard — v16
- [x] Guarded deletes (type-to-confirm + what-you-lose) for event / season / society — v16
- [x] Society always visible + changeable in the wizard; "+ A new society" — v17
- [x] Sanity limits: 1–15 a hole, 27–180 gross, +9.9–54.0 index — v17
