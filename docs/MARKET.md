# What we're up against

Researched 1 Aug 2026 from live sources. Where two passes of research disagreed,
both figures are shown and flagged — don't quote a disputed number at anyone.

---

## The single most useful thing we learned

**HowDidiDo started charging in January 2026.**

Announced 22 Nov 2025, launched 12 Jan 2026. The three ClearCourse apps
(HowDidiDo, ClubV1 Members Hub, igMember) were merged into one, and after years
of being free it now costs **£2.99/yr with ads, £9.99/yr ad-free**, with clubs
able to cover all their members for £1,400/yr. 200,000+ users signed up in the
first six weeks.

The most trusted free name in UK club golf just put up a paywall, for exactly
the golfers Societee is aimed at. **Paying for golf software has been normalised
by someone else, at their cost.** That materially de-risks charging — and it
leaves goodwill friction we can be the pleasant alternative to.

---

## Squabbit is not a weak competitor

| | |
|---|---|
| App Store (UK) | **4.89 ★ from 1,056 ratings** |
| App Store (US) | 4.90 ★ from 4,867 ratings |
| Google Play | 4.9 ★, **250,000+ installs** |
| Developer | Orrie Shannon — **one person** |
| Cadence | 2–3 releases a week (v26.7.27 shipped 1 Aug 2026) |

*(UK rating, version and developer independently re-verified against Apple's
lookup API.)*

About 1.3% of ratings are one or two star. **Users don't hate it.** Any pitch
that assumes otherwise will bounce off anyone who's used it.

### Three cracks

**1. It cannot read an English handicap, and says so.**

> "Some countries, like **England** and Australia, do not have public access to
> player handicap data and cannot be supported in Squabbit."

Automatic lookup covers the USA, Canada, Mexico and Africa. UK golfers type
their index in and maintain it by hand — while the marketing site still
advertises "WHS handicap integration."

**2. It's built for the organiser, not the other 39 players.** The recurring
complaint across reviews and roundups is navigation, specifically that it's
clunky "for users and not managers." One organiser: *"Excellent when you can get
everyone on the app… some people want it to be easier."* That is exactly the gap
we're aiming at.

**3. Its pricing story has quietly broken.** The site says "completely free, no
hidden costs." Both App Store listings now carry a **£99.99/yr "Host Pro"**
subscription and a **£29.99 single-event** unlock, documented nowhere else.

**Unclaimed: women's golf.** A real UK review:

> "Used it today at a male dominated tournament. I am female & it thought I
> played off mens course… sadly as we're 2nd class citizens it's not set up for
> us." — *3★, UK*

Mixed tees and per-player tee selection are cheap and nobody has done them
properly. Build it in from the start, not as a later fix.

---

## The UK field

Real, immature, and filling up fast — three UK entrants in fourteen months.

### They charge a subscription

| Product | Price | Traction |
|---|---|---|
| **Society Golfing** | 3-month trial, then **£40/yr** | **900+ member societies** — the biggest installed base at any price |
| **Golfshake Groups** | free tier · **£29.99/yr** Club · Platinum from £49.95 | 200,000+ registered golfers, 230k monthly visits |
| **Your Golf Society** | 30-day trial, then **£69/yr** | web-only by design, "1,000s signed up" |
| **golf-soc.com** | free <20 members · **£99/yr** Standard · **£250/yr** Premium | UK testimonials incl. Swinley Forest |
| **SOC.GOLF** | **£39/yr** ≤30 members · **£79/yr** unlimited ⚠️ *possibly the same product as golf-soc.com; the two passes found different tiers* | — |
| **Golfify** | free ≤8 players, then **£49.99–£199.99/yr** by size | 4.67★, 46 ratings |
| **My Society Golf** | free **with ads**, IAP £9.99 and £99.99/yr | 4.0★, 4 ratings |
| **HandicapMaster** | ⚠️ ~£50/yr for the society edition (forum claim, unverified — every shop page 403s) | 1,000+ clubs, Windows desktop |

### They take a cut of payments

| Product | Cut | Traction |
|---|---|---|
| **ParUp Golf** (London) | app free · **4.5% on GBP** (5–6% other currencies), covers Stripe + their fee | 4.40★, **84 ratings** — the traction leader of the new cohort ⚠️ *launch date disputed: 17 Jun 2025 or Jun 2022* |
| **RiddyGolf** (Bexhill) | free, no subscription · "a small service fee", **percentage not published** | **launched 1 Jun 2026** — two months old. 5.0★, 5 ratings |

### Free

**Quick9** (no ads; distribution deal with PlayMoreGolf across 200+ courses),
**Golf Society Manager** (golfsocietymanager.com — free, no card, 20 formats,
live leaderboards, AI scorecard import), **Club Sports** (genuinely free, dated),
**Society Golf App** (v1.0.4, Jan 2026, too new to rate), **Golfing Society
Websites** (society sites with match management — members *bid* for places and
teams are picked automatically, which is a genuinely different idea), and
**WaCaS** — in beta, explicitly built for UK golf days, pricing and operator
undisclosed. Worth watching.

### The verdict on price

**The paid band is £30–£99 per society per year, and the largest installed base
sits at £40.** Nobody charges per player. Nobody charges monthly except as an
annual equivalent. The two newest entrants both chose payment cuts over
subscriptions.

And organisers are openly hostile to paying at all:

> "I wouldn't pay for an app, personally. It would just be a tool for editing a
> database and would probably be less 'clean' than just using sheets."

> "Issue with an app is many swindles use various different methods for
> handicaps, winnings, OOM etc. Going to be very hard to encompass all."

That second warning is the sharper one: **every swindle has its own rules.**
Rigid formats lose. The real incumbent is WhatsApp and a spreadsheet.

But the demand is real too, from a society admin on the same forum:

> "I am shocked that a sport the size of golf with the number of societies
> currently active all over the world is being catered to so poorly."

Their stated must-haves: auto-updating handicaps, live scorecards across
multiple competitions, **support for non-affiliated members**, multiple admins,
PDF reporting.

---

## The handicap wall — read before promising anything

England, Wales and Ireland run the same WHS platform, built by DotGolf. A real
API exists and its spec is public (`isvapi.whsplatform.englandgolf.org`),
returning a player's Handicap Index, their top 20 scores, and webhooks on
handicap changes.

**Access is granted per affiliated club.** Credentials are issued to a club, and
`/club/members` returns that club's members. There is no OAuth, no
golfer-consent flow, no individual authorisation anywhere in the spec. **A
society is not a club.** As part of the WHS rollout, independent software vendors
were cut off from open access to handicap data. Scotland went further — its ISV
licence is write-only by policy.

So **every UK competitor runs its own internal handicap**: Golfshake, ParUp,
RiddyGolf, Golfify, Society Golfing, HandicapMaster, Club Sports. ParUp says WHS
integration is "planned soon" — treat that as aspirational, and if anyone
actually ships it, drop everything and find out how.

Contrast: **Golf Directo syncs official handicaps with the Spanish federation.**
The barrier is English governance, not technology. The USGA runs a Golfer Product
Access programme in the States explicitly for "vendors supporting individual
golfers." Same global handicap system, different door policy.

**What this means for us:**

- **Do not advertise WHS integration.** Everyone who implies it is stretching.
- Organisers enter and maintain handicaps, like every competitor.
- Put it behind an interface so an official source can drop in later.
- **The opening is iGolf.** England Golf sells non-club golfers an official
  Handicap Index for **£47/yr** and actively markets it to societies and
  corporate days as the answer to "bandits". Nobody has built a clean workflow
  around it. Whoever does gets the closest thing to legitimacy available.

**Scraping is not an option.** HowDidiDo's terms bar including their data in
"any public or private electronic retrieval system" and cite the Computer Misuse
Act 1990. The only technical route is harvesting golfers' credentials — a
business-ending risk, not a shortcut.

Society rounds **can** count for WHS, but with a catch worth knowing before we
promise anything: in GB&I a player must **pre-register before teeing off** for a
score to count, and pre-registration happens on club terminals or the
club/governing-body apps — not on ours. Register after your tee time and the
score is ineligible. So the most Societee can honestly offer is helping produce a
card the golfer submits himself, having pre-registered elsewhere.

Card verification is the easy half: club members, iGolf subscribers and free
iPlay users can all verify each other, provided the verifier witnessed the round.

**One more nuance on iGolf.** Its terms say a subscriber "will not have the right
to enter into club, county or England Golf competitions (competition entry
remains at the discretion of the competition organiser)." For our purposes that
sentence is *good news* — in a society competition, the organiser **is** the
competition organiser, so an iGolf index is perfectly usable. It's club and
county events that are closed.

---

## The money question nobody has answered

RiddyGolf surveyed 71 society organisers. **41% said collecting green fees was
the hardest part of the job** — harder than scoring.

That's a bigger pain than the one we're currently solving, and it's why both
newest UK entrants monetise payments rather than subscriptions.

It also drags in real regulation. Holding players' money likely engages the
Payment Services Regulations 2017; the FCA's commercial agent exclusion doesn't
apply to a firm acting for both payer and payee, which is exactly a pot-holding
app. New FCA safeguarding rules apply from 7 May 2026.

**If we ever do payments, use a payment service provider with payment initiation
so Societee never takes custody.** Decide that deliberately.

*(The research also covered UK gambling law for paid-entry competitions — moot,
those are out of scope. Short version if it ever comes up: playing your own round
for a prize pot isn't gambling and can be run commercially; anything where
someone predicts, or is drawn at random, needs a licence.)*

---

---

## ⚠️ The four home nations stopped applying WHS identically — build for this

**From 1 April 2026, Ireland, Scotland and Wales adopted flexible Playing
Handicap allowances.** Organisers there may set singles at **85 / 90 / 95 /
100%** and fourball at **75 / 80 / 85 / 90%**.

**England declined**, postponing until 2028 "in line with the wider WHS review
cycle." So 95% singles and 85% fourball remain mandatory in England.

This is a direct product requirement, not background reading:

- **Tom's societies play in Wales, where the flexibility applies.** A Welsh
  society can legitimately run a day off 90%, and if we hardcode 95% we'll be
  scoring it wrong.
- The allowance therefore has to be **selectable per event**, defaulting to 95%,
  with fourball allowances available when team formats arrive.
- `events.handicap_allowance` already exists in the schema for exactly this.

Any competitor that assumed a single UK-wide rule is now quietly wrong in three
of the four unions. That's a small, real, checkable advantage.

---

## Incumbents are channel, not competition

Every UK club system sells to the **affiliated club**. Where "societies" appear
in their marketing, the society is the club's visiting customer and the club is
the buyer.

- **ClearCourse** owns HowDidiDo, ClubV1, Club Systems and intelligentgolf
  (acquired 2019 and Sept 2022) — ~2,000 clubs, ~1m golfers across UK & Ireland.
  No society-facing product. HowDidiDo's January 2026 rebuild actually *tightened*
  the gate: you now register by matching yourself to an existing player record at
  a subscribing club. There is no non-club signup path at all.
- **intelligentgolf** does advertise "society and golf day management" — but the
  page is written for the club managing its *visiting* society business: block
  tee bookings, room bookings, menu choices, revenue tracking.
- **BRS Golf** — 1,500+ clubs, 675,000+ members. Owned by GolfNow, which moved
  from Comcast to **Versant Media Group** in the January 2026 spin-off; the "NBC
  Sports Next" brand has been retired. Partners with Golf Genius so *clubs* can
  monetise society days.
- **HandicapMaster** is a licensed ISV and *still* can only offer societies
  private "local handicapping".

**Almost none of them sells to the society. That gap is the whole opportunity** —
and they're all better viewed as distribution partners than rivals.

**The one exception, and it's worth watching.** Golf Genius sells **Trip Manager
at $149 per trip** (up to 12 rounds, 36 players) directly to an organiser, no
facility required. It has zero UK localisation, prices in dollars, and can't
touch official handicaps — but it *is* a self-serve product an organiser can buy
today, from a company that is an authorised WHS licensee to all four home nations
and England Golf's official tournament software supplier. If anyone has the
credentials to solve the handicap problem, it's them.

Two more worth knowing:

- **VPAR** runs UK corporate and charity golf days as a **managed service from
  roughly £295 to £895+VAT** per event. There is **nothing self-serve between
  the free apps and VPAR's service tier** — a genuinely unoccupied, higher-value
  band.
- **Golf Empire** is not a competitor: it's a directory of 10,000+ open amateur
  competitions with **155,000 registered users**, premium at ~£15/yr. That's a
  distribution channel.

---

## Corrections and cautions

- **"Anywhere Golf" doesn't exist** as a UK society product. Drop it.
- **Eagle** is course signage; **GolfBox** is federation B2B; **Whoosh**,
  **Lightspeed**, **Golfmanager** are club operations platforms. None are rivals.
- **"15,000 golf societies in the UK and Ireland"** traces to a GolfMagic article
  from 2003, updated 2013. **Dated — don't cite it.** Nobody publishes a current
  figure. Verified anchors instead: 750,071 England Golf club members in 2025;
  ~2.3m independent golfers in England; Society Golfing's 900+ societies.
- **Unverified:** Golf Genius pricing (their pricing page redirects to a broken
  domain), VPAR and HandicapMaster pricing, England Golf's current ISV list and
  fee, RiddyGolf's actual payment percentage, and whether TournamentCaddie is
  winding down (its marketing pages now redirect to a login wall).
