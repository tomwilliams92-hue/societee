# Squabbit, feature by feature — and where Societee stands

Compiled 4 Aug 2026. The Squabbit column comes from their compiled app bundle
(literal UI strings and enums — ground truth, not marketing), their help site,
and their release notes. Statuses are honest: ✅ have · 🟡 partial · 🔴 missing ·
⛔ deliberately not building (with the reason).

## How Squabbit is organised

Five root tabs: **Feed · Groups · Play · Search · Profile**. Inside a
tournament: **Home · Leaderboard · Schedule · Events · Activity**. Settings has
seven tabs plus its own search box and an AI fallback. Creating a tournament is
a five-step wizard (name → rounds → course → formats → players), every step
skippable.

## The audit

### Core scoring & competition

| Squabbit | Status | Societee |
|---|---|---|
| Hole-by-hole scoring, one scorer per group | ✅ | Group link, steppers, points live per hole |
| Full scorecard view with per-hole detail | ✅ | Tap any player: circles/squares notation, shot dots, pts per hole, OUT/IN |
| Playing handicap computed from tee (CR/slope/SI) | ✅ | Ours also enforces the 2026 country allowance rules — theirs doesn't |
| Handicap derivation shown inline | ✅ | The ⓘ on every entry row |
| Live leaderboard with thru/position | ✅ | Plus "still out" players shown, not hidden |
| Stableford | ✅ | Verified against the WHS formula end to end |
| 46 tournament formats (skins, matchplay, Ryder Cup…) | ⛔ | One format done perfectly beats 46 configured in two hours. Formats are the "settings daunting" complaint. Medal/skins later if organisers ask |
| 41 mid-round side games | ⛔ | Same reason. NTP + longest drive covered |
| Multi-round tournaments | 🔴 | Real gap — the Order of Merit covers seasons but not a 2-day trip. Worth building |
| Team formats / flights / purses | 🔴 | After real-user feedback, not before |
| Scorecard markers (attest, orange unofficial, red discrepancy) | 🔴 | Their best idea. Needs the shared DB — queued behind the anon key |
| Offline scoring with sync | 🟡 | Demo is offline by nature; real offline sync needs the DB wiring |

### People & joining

| Squabbit | Status | Societee |
|---|---|---|
| QR spectator view, no account | ✅ | The public board |
| QR → score with no account | ✅ | Group scoring links — ours needs no name-matching step at all |
| Player profile with handicap | ✅ | New Profile tab; saving flows into matching player rows |
| Accounts for every player | ⛔ | Their duplicate-account mess (which organisers can't fix) is the argument against. Players are rows; profiles claim rows |
| Invite codes / links / email invites | 🟡 | Organiser adds names; share links exist. Real invites make sense with the DB |
| Registration/self-signup with custom fields | 🔴 | Genuinely useful for big days — roadmap |
| Follow/friends/social feed | ⛔ | A 24-person society is already a social network. WhatsApp does this |

### Around the golf

| Squabbit | Status | Societee |
|---|---|---|
| Season leagues with standings | ✅ | Order of Merit, best-N, counts ordinary club rounds too |
| Course database (39k+ courses) | 🟡 | 5 courses with **verified** cards vs their large-but-erroneous DB (wrong-card complaints in their reviews). Organiser card entry validates SI/par |
| Tee sheet / schedule / shotgun starts | 🟡 | Groups with start holes; no tee times yet |
| Stats (streaks, blow-ups, 50+ league stats) | 🔴 | Season stats are the natural "earn the subscription" feature |
| Photos / activity feed | 🔴 | WhatsApp does this today; revisit |
| AI recaps, AI settings assistant | ⛔ | Their AI settings search exists because their settings need searching |
| GPS / shot tracking / Apple Watch | ⛔ | Different product. Squabbit can keep it |
| Payments / purses / balances | ⛔ | FCA safeguarding territory — deliberate, documented decision |
| Desktop web app for setup | ✅ | Ours is web-native everywhere by default |
| Print scorecards / cart signs / CSV export | 🔴 | Cheap, useful, roadmap |
| Push notifications | 🔴 | Needs the PWA push wiring — real, planned |

### Navigation (their weakness, our edge)

| Their complaint | Ours |
|---|---|
| "Seven levels to my round… I give up 8 times out of 10" | Live day is one tap from anywhere, permanently |
| Settings "daunting, took 2 hours" — 7 tabs + search + AI | Three tabs, no settings screen at all |
| Same UI for organiser and players — "clunky for users not managers" | Organiser/player/spectator are different URLs with different chrome |
| One tab called four names in their own docs | One name per thing |

## The honest summary

Where they are genuinely ahead: **breadth** (formats, stats, integrations),
**markers**, **multi-round events**, **push**, and ten thousand courses. Where
we are ahead: **navigation**, **zero-account joining all the way to scoring**,
**verified course data**, **handicap transparency**, **2026 allowance rules**,
and everything being one tap deep. Their moat is years of accumulated features;
ours is that a 55-year-old society captain can run a day without a manual.

Next three to close, in order: **markers** (needs DB), **multi-round events**,
**push notifications**.
