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

1. Sign up at **supabase.com** and create a project.
   - Region: **London (eu-west-2)**. It's the only UK one, and it keeps your
     players' names and scores under UK jurisdiction, which is the simplest
     position for UK GDPR.
   - Save the database password it gives you.
2. Open the **SQL Editor** in the sidebar, and run these two files from this
   repo, in order:
   - `supabase/schema.sql` — every table, the security rules, and the functions
     the QR code and the scoring links use
   - `supabase/seed_courses.sql` — Conwy, Bromborough, Wallasey, St Melyd and
     Abergele, with their real ratings
3. Go to **Project Settings → API** and copy two things:
   - the **Project URL**
   - the **anon public** key (the long one — the `service_role` key is a master
     key, never put it in the app)
4. Create `app/.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

The free tier is 500MB of database and 50,000 monthly active users. Fifty
societies won't trouble it.

**Nothing breaks while you wait.** With no keys the app runs exactly as it does
now, on local storage, with the demo societies. The keys are the switch.

---

## 2. GitHub — somewhere for the code (5 minutes)

Vercel deploys from a repository.

1. Create a new **private** repo at github.com — call it `societee`.
2. From `~/Societee`:

   ```bash
   git remote add origin https://github.com/<your-username>/societee.git
   git branch -M main
   git push -u origin main
   ```

`.env.local` is already in `.gitignore`, so your keys stay off GitHub. That's
deliberate — they go into Vercel separately.

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
