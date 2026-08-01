# Societee — the brief

Decisions taken 1 August 2026. This is the document to argue with later; if
something here turns out to be wrong, change it here rather than quietly
building something else.

---

## One sentence

**Societee is the easiest way to run a golf society.**

Not a golf app. Not a GPS, a shot tracker, a coaching tool or a social network
for golfers. Software for the person who *organises* the golf.

## Who pays

The organiser. One person, for a group of twenty-four.

That single fact drives everything else: the pricing, the permissions, the
onboarding, and the reason the product can grow without convincing every golfer
in Britain to install something.

## The four kinds of people

| | Needs an account? | Pays? | Can do |
|---|---|---|---|
| **Owner** | Yes | **Yes** | Everything. Owns the societies, holds the subscription. |
| **Admin** | Yes (free) | No | Runs one society: creates days, enters scores, manages players. A free seat under the owner's plan. |
| **Player** | **No** | No | Appears on the card. Has a name, a handicap and a history — and no login. |
| **Spectator** | **No** | No | Opens the public link. Watches the board. |

The distinction that matters, and the one that was muddled in the original
thinking: **an account is someone who can log in; a player is someone who
appears in competitions.** They are not the same thing and must never be
conflated in the schema, the UI or the pricing.

A player who later wants to organise their own society creates an account and
*claims* their existing player record, so their history travels with them.
`players.claimed_by` exists for exactly this.

## Pricing

**Revised 1 Aug 2026 after the market research — the first draft was wrong.**
See `MARKET.md` for the evidence.

Charge annually, per society, on capacity and features. Never per player —
"you've reached 20 players" is the message that gets you uninstalled, and it
punishes the organiser for the thing you want them to do.

| Plan | Price | What you get |
|---|---|---|
| **Free** | £0 | 1 society, 3 golf days, unlimited players, basic leaderboard |
| **Pro** | **£39/year** | Unlimited societies and days, live scoring, QR boards, season Order of Merit, stats, public links |
| **Club** | **£99/year** | Multiple organiser seats, club branding, sponsor logos, custom URL, CSV export |

**Why annual, not the £5.99/month of the first draft.** Nobody in this market
bills monthly, and golf societies are seasonal — an organiser paying in January
for a season that starts in May will cancel in February. Annual matches the
shape of the thing being sold.

**Why £39.** The paid field runs £30–£99 a year, and the biggest installed base
in it — Society Golfing, 900+ societies — sits at £40. That price is proven to
clear. It undercuts Your Golf Society (£69) and golf-soc (£99), and it reads as
less than one green fee, or about £1.60 a head across a society of 24. Squabbit's
undocumented Host Pro is £99.99, so we are a quarter of the competitor people
already think is free.

The free tier's job is to let someone run a real golf day and get hooked, not to
be permanently sufficient. Three days is about one summer's roll-up.

**The known risk:** organisers say out loud that they won't pay for this, and
several strong products are free. Two things cut against that. HowDidiDo — the
most trusted free name in UK club golf — started charging in January 2026, which
normalises paying. And the free rivals monetise by taking **4.5% of the green
fees** instead, which on a £40-a-head society day is £1.80 per player per outing.
A £39 flat fee is cheaper than that for anyone who plays more than once a season,
and it's a straight answer rather than a percentage. Say so plainly.

Taking a cut of green-fee payments is the obvious alternative model and the one
both new UK entrants chose. It's also the harder one — see the FCA note in
`MARKET.md`. Not now.

## In scope for version 1

Only enough to answer one question: *can I run an entire golf day with this
instead of WhatsApp and a spreadsheet?*

- Create a society, add players with handicap indexes
- Create a golf day — course, tee, date; course and playing handicaps computed
- Enter a gross, get Stableford
- Live leaderboard
- Public share link and QR code, no login required
- Season Order of Merit (best N cards count)
- Nearest the pin / longest drive
- **Per-player tee selection.** Cheap to build, and the competition genuinely
  fails at it — a woman playing off the reds gets scored off the men's card in
  the market leader, and reviewers say so. Do it properly from the start.

**Handicaps are entered by the organiser and maintained by hand.** So is
everyone else's — official WHS data is closed to independent vendors in England
(see `MARKET.md`). Do not advertise WHS integration. Keep the handicap source
behind an interface so an official one can be dropped in if the door opens.

## Explicitly out of scope

Decided by Tom, 1 Aug 2026:

- ❌ Community challenges and national leaderboards
- ❌ Gross / scratch competitions and "performance rankings"
- ❌ Paid-entry competitions with prize pots and a cut for us
- ❌ Anything Squabbit is already good at: GPS, shot tracking, Apple Watch,
      a worldwide course database, dozens of tournament formats

The last one is the important discipline. Chasing feature parity is a race that
takes years and is lost at the start.

## What we're actually up against

Read `MARKET.md` before arguing with any of this. The short version:

- **Squabbit is good and free.** 4.89★ from 1,056 UK ratings, shipped by one
  developer two or three times a week. Nobody is switching because it's bad.
- **The UK-native field is small but filling fast** — ParUp launched 2025,
  RiddyGolf in June 2026, WaCaS in beta now.
- **The real incumbent is WhatsApp and a spreadsheet**, and organisers say on
  forums that they won't pay for an app. That, not the competition, is the risk.
- **Nobody can read official English handicaps.** Every product fakes it with an
  internal one. It's a governance wall, not a technical one.
- **The club systems aren't rivals** — ClearCourse, BRS and Golf Genius all sell
  to clubs and monetise societies *through* them. Potential channel, not enemy.

## Why this can win

**1. It's the experience, not the feature list.** Tom's honest reaction to the
main competitor was "I don't find it visually appealing or easy to navigate" —
and the reviews back him up, complaining it's clunky "for users and not
managers." The design bet is a clubhouse honours board: cream scorecard paper,
bottle green, brass rules, engraved type. Nothing else in this category looks
like anything but generic sports software.

**2. Nobody has to sign up.** The organiser is the only account. Everyone else
scans a code. That removes the single biggest reason group apps die on the
first tee — and it's the specific thing the market leader's own users complain
about.

**3. Every event is a demo.** Sixteen players scan a QR code and spend four
hours looking at your product. That's the referral loop, and it's free.

**4. Tom is the customer.** He organises the golf, he's played off plus figures,
and he knows what an organiser actually spends Sunday night doing. Features come
from real irritations rather than guesses.

**5. Somebody else did the hard work on price.** HowDidiDo spent years being
free and started charging in January 2026. Asking a golfer to pay for software
is no longer the strange request it was eighteen months ago.

## The one thing to get right first

The first-time flow. Create a society, add players, create a day, share a QR
code — in under five minutes, with no manual and no learning curve. If that
flow is delightful, the rest follows. If it isn't, no feature saves it.

## Roadmap

**Now — v1.** The scope above, on real infrastructure, running one or two real
societies through a real season.

**Then — earn the subscription.** Season stats, records, head-to-head, form and
handicap trends. Photos. PDF results for the WhatsApp group.

**Later — worth paying more for.** Club tier: branding, sponsor logos, multiple
organisers, exports. AI event write-ups, as a Pro feature, only once it's cheap
and only if organisers actually want it.

## Open questions

- **Will anyone pay?** This is the real risk, not the competition. Organisers say
  on forums that they won't, and Squabbit, ParUp, RiddyGolf and Quick9 are all
  free at the point of use. The plan is to find out early rather than build for
  six months on the assumption — get the free tier in front of twenty organisers
  and watch whether any of them hit the three-day ceiling and ask for more.
- **Course data.** Every course a society plays needs its CR, slope and par
  before rounds can be scored, and its full card before hole-by-hole scoring
  works. A handful are seeded. How that table gets filled at scale — organisers
  entering them, or a bulk source — is unsolved and will bite eventually.
- **Trade marks.** Domains are clear. Whether "Societee" is registrable, or
  already registered by someone, is unchecked — see `SETUP.md`.
- **First twenty organisers.** Tom's own club, his society, and the local clubs
  are the obvious start. Golf Empire (155,000 registered users, a directory not
  a rival) is a plausible distribution partner later.

## Parked, but worth remembering

**Corporate and charity golf days.** VPAR runs them as a managed service from
roughly £295 to £895+VAT per event, and there is nothing self-serve between the
free society apps and that. One organiser, one day, a real budget, and sponsor
logos already in the Club tier. It's a different sale and a different product, so
not now — but it's the most valuable unoccupied space anyone found, and Societee
would already be most of the way there.
