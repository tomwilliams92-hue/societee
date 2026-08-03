# Flow — what to take from Squabbit, and what to do differently

Researched 3 Aug 2026, largely from Squabbit's own help site, blog, and its
compiled web bundle (which gives the literal tab and wizard strings).

Squabbit sits at **4.90★ from 4,891 iOS ratings** and is built by one developer
shipping two or three times a week. Its information architecture is a
*competence tax*, not a blocker — survivable and rewarding for a motivated
organiser, and it leaks badly at the edges. Those edges are the opportunity.

---

## Their structure

**Root tabs:** Feed · Groups · Play · Search · Profile
**Inside an event:** Home · Leaderboard · Schedule · Events · Activity
**Settings:** General · Players · Formats · Schedule · Display · Notifications · Actions · Help

Creating a tournament is a five-step wizard (added only in **July 2026** —
before that it was a single settings page): name → how many rounds → course and
tees → scoring formats → add players. Every step has *Skip for now*, and there's
a *Set up manually* escape hatch throughout. Under a minute with defaults.

They offer **46 tournament formats** and 41 mid-round side games.

---

## Take these

1. **QR → scoring in about four taps, no account.** Scan, "I'm playing", type
   your name, match to the roster, score. Spectators get the leaderboard with
   nothing at all. Best-in-class, and it fixes the number one failure of every
   group app.
2. **One scorer per group by default.** Their words: *"you only need one person
   per group to sign up and do the scorekeeping."* Never assume full-field
   adoption. **This is what Societee does.**
3. **Scorecard markers.** A marker's entries are official; the player can still
   enter their own, which show as *unofficial, in orange*. On submit you get a
   side-by-side comparison with **discrepancies in red**, then a lock. The best
   single idea in the product — attestation that doesn't block play. Worth
   building when we have real users.
4. **Show the handicap derivation inline.** An info icon expands the full
   calculation of a playing handicap. Kills the most common dispute at the point
   of doubt. Cheap; do it.
5. **Both score-entry axes.** Hole-major for the marker on the course,
   player-major for the organiser typing up paper cards afterwards. Squabbit
   only auto-advances hole-major and gets asked for the other. **Societee has
   both already** — the group scorer is hole-major, the event page is
   player-major.
6. **Escape hatches in any wizard.** Skip a step, or bail to manual entirely.

---

## Deliberately do differently

1. **One name per thing.** Squabbit's own documentation calls a single tab
   "Tournament", "Groups", "Compete" and "Competitions". They also had to run a
   migration to collapse "game" vs "format" because nobody could tell them
   apart. Pick the noun and never deviate.
2. **Split the organiser surface from the player surface.** Their most-cited
   complaint is that it's clunky *"especially for users and not managers"* — a
   gear icon sits on every tab for everyone, and players scroll the same
   seven-tab settings screen built for configuring purses. **Societee separates
   these by route:** organisers use `/s` and `/e`, players get `/score/<token>`,
   spectators get `/live/<token>`. Keep it that way.
3. **Never bury the round someone is playing right now.** Reaching a live league
   round in Squabbit is: Groups → Leagues → league → Events → event → Schedule →
   tee time → Start. Seven levels for the most frequent action in the product.
   One user: *"I literally give up eight times out of ten when I try to find our
   events."* **To do: a "you're playing now" card at the top of the home page.**
4. **Don't make the user choose the object before the wizard.** Tournament vs
   League vs Club is asked up front and there's a help article explaining it,
   which means the choice is in the wrong place. A society organiser was told by
   the developer he'd built the wrong one. Ask about the *play pattern*, derive
   the object.
5. **Don't let settings-search substitute for structure.** They shipped search
   *inside* settings — *"no guessing which tab it lives under"* — and an AI
   fallback for when search fails. Three escape hatches over one taxonomy. Keep
   every settings group under about ten rows instead.
6. **"Created" must mean "playable".** Their bundle contains strings like *"An
   admin will need to add you to a tee time"* — a player can open the app on the
   first tee and be unable to score. Societee auto-creates groups at event
   creation for exactly this reason.
7. **Solve identity at the invite, not with a merge tool.** Their name-matching
   join flow produces duplicate accounts so routinely it has a branching help
   article, and — worst of all — *the organiser cannot fix it*: only the player
   can merge their own accounts. **Societee sidesteps this entirely** because
   players are rows in the organiser's database, not accounts. That's a real
   structural advantage, not just a simplification.

---

## Where Societee stands against this

| | Squabbit | Societee |
|---|---|---|
| Player accounts | Required unless via QR guest | **Never** |
| Duplicate-identity problem | Documented, organiser can't fix | Doesn't exist |
| Scoring | Hole-major, one scorer per group | Same |
| Formats | 46 | 1 (Stableford), deliberately |
| Settings surface | 7 tabs + search + AI | 3 tabs |
| Path to today's round | Up to 7 levels | 2 — **to be 1** |
| Handicap source | Manual (can't read English WHS) | Manual, same wall |

The honest read: we are not going to out-feature a product with 46 formats and
a developer shipping three times a week. We win, if we win, on being obvious.
