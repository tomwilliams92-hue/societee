# Putting it online

Three accounts, all free, about half an hour. Do them in this order — the
database first, because a public address without shared data is no use.

---

## Why both

Right now every device keeps its own copy of everything in its own browser. On
your Mac that's fine. But it means **a QR code only works on the phone that made
it** — scan it on somebody else's and they get their own empty copy, not your
golf day.

Vercel gives the app a public address. Supabase gives it shared data. You need
both before a scoring link means anything.

---

## 1. Supabase — the database (10 minutes)

### 1.1 Make the account

Go to **supabase.com** → **Start your project** → sign in with GitHub (you
already have an account, so this is two clicks and no new password).

### 1.2 Create the project

**New project**, then:

| Field | What to put |
|---|---|
| Name | `societee` |
| Database password | Click **Generate a password**, then **copy it somewhere safe** |
| Region | **West EU (London)** |
| Plan | Free |

**Region matters.** London is the only UK one. It keeps your players' names and
scores under UK jurisdiction, which is the simplest position to be in for UK
GDPR. Everything else on that screen can stay as it is.

It then takes a minute or two to build. Wait for it to go green.

> The database password isn't the same as the keys in step 1.4 and you won't
> need it for the app — but save it, because it's a pain to reset later.

### 1.3 Run the two SQL files

Left sidebar → **SQL Editor** → **New query**.

On your Mac, put the first file on the clipboard:

```bash
pbcopy < ~/Societee/supabase/schema.sql
```

Paste it into the editor and press **Run** (or ⌘↵). It should say *Success. No
rows returned* — that's what "it worked" looks like for a file that only creates
things.

Now the second one, the same way:

```bash
pbcopy < ~/Societee/supabase/seed_courses.sql
```

New query → paste → Run.

**Order matters** — the second file fills in tables the first one creates.

What those two files do: the first builds all fifteen tables, the security rules
that stop one society seeing another's scores, and the functions behind the QR
code and the scoring links. The second loads Conwy, Bromborough, Wallasey,
St Melyd and Abergele with their real ratings and scorecards.

> If the first file throws an error, paste the error back to me rather than
> trying to fix it. It's never been run against a live Postgres, so one or two
> corrections are expected.

### 1.4 Copy the two keys

Left sidebar → **Project Settings** (the cog) → **API**.

Copy:

1. **Project URL** — looks like `https://abcdefgh.supabase.co`
2. The **anon** / **public** key — a very long string starting `eyJ...`
   (newer projects may label this **publishable**)

⚠️ **Do not copy the `service_role` / `secret` key.** That one bypasses every
security rule in the database. It must never go anywhere near the app or the
browser.

### 1.5 Give them to the app

Either paste both to me and I'll wire it up, or create the file yourself:

```bash
cat > ~/Societee/app/.env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EOF
```

The free tier is 500MB of database and 50,000 monthly active users. Fifty
societies won't trouble it.

**Nothing breaks while you do this.** With no keys the app runs exactly as it
does now — local storage, demo societies, the lot. The keys are the switch.

---

## 2. GitHub — done ✅

**github.com/tomwilliams92-hue/societee** — private, already pushed.

Nothing to do. From now on, to publish changes:

```bash
cd ~/Societee && git push
```

`.env.local` is in `.gitignore`, so your Supabase keys never reach GitHub —
they go into Vercel separately in step 3.

---

## 3. Vercel — the hosting (10 minutes)

1. Sign in at **vercel.com** with your GitHub account.
2. **Add New → Project**, pick the `societee` repo.
3. Set **Root Directory** to `app` — the repo has docs and SQL at the top level,
   so Vercel needs pointing at the app itself.
4. Under **Environment Variables**, add the same two keys from step 1.
5. Deploy.

You get a URL like `societee.vercel.app`. Every push to `main` redeploys.

To use a domain later, add it under **Settings → Domains** and Vercel handles the
certificate.

---

## What it costs

| | Monthly |
|---|---|
| Supabase | £0 (free tier) |
| Vercel | £0 (hobby tier) |
| GitHub | £0 |
| **Total** | **£0** |

A domain, if you want one, is about £10 a year. Not needed to run a golf day.

---

## Showing it on a phone before any of this

Already works, on your own wi-fi:

```bash
cd ~/Societee/app
npm run phone
```

Then open `http://<your Mac's IP>:3000` on the phone and **Add to Home Screen**.
Use `npm run phone` rather than `npm run dev` — dev mode blocks other devices
from loading the JavaScript, which makes the app look broken in a way that gives
you no clue why.
