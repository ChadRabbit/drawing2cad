# Handoff: where Drawing2CAD stands

For anyone (person or agent) picking this up, especially to build the conversion engine. Read this, then
`README.md` and `docs/ENGINE.md` (the contract the engine must follow).

## What is live

| Piece    | Where                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Website  | https://drawing2cad.vercel.app (Vercel project `drawing2cad`, team `saransh-mehras-projects`, hobby plan) |
| Database | Supabase project `drawing2cad`, ref `lbhuhxcxrusimxjfxwrd`, region ap-south-1 (Mumbai), org QuoteMyDesign (free plan) |
| Auth     | Google sign-in through Supabase. Owner = `mehrasaransh2004@gmail.com` (in `public.admins`) |
| Payments | Razorpay, not configured yet (no keys)                                                   |

Migrations in `supabase/migrations/` are applied to the live project. Deploys are manual:
`vercel deploy --prod` from this folder (the repo is not connected to Vercel's Git integration yet).

Secrets are never in the repo. The Supabase secret key lives in Vercel's production environment as
`SUPABASE_SECRET_KEY`; get it from the Supabase dashboard (Project Settings → API Keys) for the engine.

## The engine

Not built. Until it exists the owner prices drawings and uploads STEP files from `/admin`.

- Internally the plan is Claude (Opus) plus Docker. **Customer-facing text must never mention Claude,
  Anthropic, Docker or any tooling.** The site says "AI" only. Error messages and `estimate_note` stay in
  plain language about the drawing.
- The engine talks to Supabase with the secret key, using the `engine_*` SQL functions in `docs/ENGINE.md`:
  claim → quote → (customer confirms) → claim → progress → complete, or fail.
- Tiers and coin prices live in the `tiers` table: Simple 20, Medium 50, Complex 100 coins.
- Files: uploads in the private `drawings` bucket, results in the private `models` bucket, both under
  `<user_id>/…`.

## Business rules decided so far

- **No refunds.** Coins are spent when the customer confirms a quote and are kept even if the job then
  fails (`engine_fail_job` does not refund). Nothing is charged for a drawing that fails before it is
  quoted or confirmed.
- **Customers cannot delete models.** Drawings and models are kept with the account.
- **Training on uploads** is allowed. It is disclosed in the privacy policy only ("to improve the service,
  including training and testing the technology"), not on the marketing pages. Keep it disclosed there:
  removing it would put the site in breach of India's DPDP Act and GDPR. Account deletion on request (by
  email) stays, as the law requires.
- Signup bonus 20 coins; coins never expire. Packs ₹499 / ₹1,299 / ₹3,999 ($9 / $24 / $72), placeholders.
- The landing page claims "(almost) Perfect, accurate models in minutes". That is only true once the
  engine works; don't market it widely before then.

## Still to do

1. Razorpay test keys + webhook secret (see README "Going live").
2. Supabase: switch the Email provider off (Google only).
3. Record the demo video, put it in `public/media/`, set `demoVideo` in `src/lib/site.ts`.
4. Rotate the Supabase secret key once (it was pasted into a chat), update it in Vercel, redeploy.
5. Vercel Pro before taking payments (Hobby is non-commercial).
6. Domain, trademark check on the name, and a lawyer's read of Privacy and Terms.
7. The engine.
