# scripts

Run against the database directly, outside the app. Both need a Postgres
connection string; the pooler one works from a normal IPv4 network, the
`db.<ref>.supabase.co` direct host is IPv6-only.

```bash
cd scripts && npm init -y && npm pkg set type=module && npm install pg
CS='postgresql://postgres.<ref>:<password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'
```

| Script | What it does |
|---|---|
| `run-sql.mjs` | Applies `.sql` files, each in a transaction, so a failure rolls back and reports the offending line rather than leaving a half-built database |
| `test-golfday.mjs` | Builds a whole golf day, scores a round through `score_hole()`, checks the totals and both read functions, then tries to abuse the scoring link. Cleans up after itself. |

```bash
node run-sql.mjs "$CS" ../supabase/schema.sql ../supabase/seed_courses.sql ../supabase/seed_holes.sql
node test-golfday.mjs "$CS"
```

`test-golfday.mjs` is the regression test for the scoring rules. Run it after
any change to `score_hole`, `scorer_group` or `public_leaderboard`.
