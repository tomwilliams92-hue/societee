# What Tom needs to do

Everything below needs a card or an email address, so it's yours to do — the
code is already waiting for it. In rough order.

---

## 1. Buy the domain — do this first

`golfsocietee.co.uk` is **free**. Confirmed against Nominet's WHOIS on
1 Aug 2026: *"This domain name has not been registered."*

Also free: `societee.app`, `playsocietee.com`, `societeegolf.com` is **not**.

Already taken, but sitting dead — no website, no DNS pointing anywhere:

| Domain | Status |
|---|---|
| `golfsocietee.com` | Registered 1 Nov 2019 via Squarespace Domains. No DNS records — parked. |
| `societeegolf.com` | Registered 1 Nov 2019, same registrar, same minute. Parked. |
| `societeegolf.co.uk` | Registered 19 Feb 2023. Resolves, but serves a 114-byte empty page. |

Nobody is trading as "Societee Golf". The two 2019 .coms were bought together
by someone who never built anything, which is normal domain-squatting.

**Recommendation: buy `golfsocietee.co.uk`.** ~£10/year at Namecheap, 123-Reg or
Cloudflare. UK societies are the whole market, `.co.uk` reads as UK, and it's
the one that's genuinely available.

Buy `societee.app` too if you want the short one for share links
(`societee.app/live/dogsaug` is a nicer thing to print on a card than the long
version). That's a *want*, not a need.

> One thing worth doing before you spend money on stationery: search the
> Companies House register and the IPO trade mark database for "Societee". I
> checked domains, not trade marks — those are different questions and only the
> second one can cost you a rebrand.

---

## 2. Supabase — the database and logins

1. Sign up at supabase.com, create a project in the **London (eu-west-2)** region.
   UK users, UK data, no transfer questions.
2. Open the SQL editor and paste in `supabase/schema.sql` from this repo. It
   creates every table, the row-level security policies, and the public
   leaderboard function that the QR code reads.
3. Copy your project URL and `anon` key into `app/.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

Free tier is genuinely enough: 500MB of database and 50,000 monthly active
users. You will not trouble it with 50 societies.

---

## 3. Vercel — hosting

Push this repo to GitHub, then import it at vercel.com. Point it at the `app/`
directory. Free tier covers you until there's real traffic. Add the domain from
step 1 in Vercel's dashboard and it handles the SSL certificate.

---

## 4. Stripe — taking money

**Not yet.** Don't wire up payments until organisers are actually using it. When
you do: Stripe account, two products (Pro monthly, Club monthly), Stripe
Checkout rather than a custom form, and the webhook writes to the
`subscriptions` table that's already in the schema.

Stripe takes 1.5% + 20p on UK cards. On £5.99 that's about 29p.

---

## 5. What it costs to run

| | Monthly |
|---|---|
| Domain | ~£1 (£10–12/year) |
| Supabase | £0 on free tier |
| Vercel | £0 on hobby tier |
| Stripe | £0 standing, ~29p per £5.99 collected |
| **Total to launch** | **about £1/month plus your time** |

The first real bill arrives when you have paying customers, which is the right
order for that to happen in.

---

## Not needed

- **An AI budget.** There's no AI in version 1 and there shouldn't be. Event
  write-ups are a nice-to-have for later, and they can be a Pro feature that
  pays for itself.
- **An app store account.** It's a web app. That's the entire point — nobody
  downloads anything.
