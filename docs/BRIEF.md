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

Charge on capacity and features. Never on the number of players — "you've
reached 20 players" is the message that gets you uninstalled, and it punishes
the organiser for the thing you want them to do.

| Plan | Price | What you get |
|---|---|---|
| **Free** | £0 | 1 society, 3 golf days, unlimited players, basic leaderboard |
| **Pro** | **£5.99/mo** | Unlimited societies and days, live scoring, QR boards, season Order of Merit, stats, public links |
| **Club** | £19.99/mo | Multiple organiser seats, club branding, sponsor logos, custom URL, CSV export |

Pro is where essentially everyone will sit. £5.99 is deliberately below the
threshold where anyone thinks about it — if it saves an organiser an hour a
month it has paid for itself several times over.

The free tier's job is to let someone run a real golf day and get hooked, not
to be permanently sufficient. Three days is about one summer's roll-up.

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

## Explicitly out of scope

Decided by Tom, 1 Aug 2026:

- ❌ Community challenges and national leaderboards
- ❌ Gross / scratch competitions and "performance rankings"
- ❌ Paid-entry competitions with prize pots and a cut for us
- ❌ Anything Squabbit is already good at: GPS, shot tracking, Apple Watch,
      a worldwide course database, dozens of tournament formats

The last one is the important discipline. Chasing feature parity is a race that
takes years and is lost at the start.

## Why this can win

**1. It's the experience, not the feature list.** Tom's honest reaction to the
main competitor was "I don't find it visually appealing or easy to navigate."
That's a real reason to build — two apps with identical features are not equal
products. The design bet is a clubhouse honours board: cream scorecard paper,
bottle green, brass rules, engraved type. Nothing else in this category looks
like anything but generic sports software.

**2. Nobody has to sign up.** The organiser is the only account. Everyone else
scans a code. That removes the single biggest reason group apps die on the
first tee.

**3. Every event is a demo.** Sixteen players scan a QR code and spend four
hours looking at your product. That's the referral loop, and it's free.

**4. Tom is the customer.** He organises the golf, he's played off plus figures,
and he knows what an organiser actually spends Sunday night doing. Features come
from real irritations rather than guesses.

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

- **Course data.** Every course a society plays needs its CR, slope and par
  before rounds can be scored, and its full card before hole-by-hole scoring
  works. A handful are seeded. How that table gets filled at scale — organisers
  entering them, or a bulk source — is unsolved and will bite eventually.
- **Trade marks.** Domains are clear. Whether "Societee" is registrable, or
  already registered by someone, is unchecked — see `SETUP.md`.
- **First twenty organisers.** The real risk isn't building it. Tom's own club,
  his society, and the local clubs around Conwy are the obvious start.
