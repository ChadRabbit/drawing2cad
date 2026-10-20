# Drawing2CAD

Customers upload a 2D engineering drawing (PDF, image, DWG, DXF), get it priced in coins, confirm, and
receive a 3D STEP model they can turn in the browser and download. Google sign-in, Razorpay coin packs,
a history of every model, and an owner panel.

The conversion engine is separate and not built yet. Until it is, the owner prices drawings and publishes
STEP files from `/admin`. `docs/ENGINE.md` is the contract the engine must follow.

## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript. Hosted on Vercel.
- Supabase: Google auth, Postgres (with RLS), Storage (`drawings`, `models`), Realtime for live job updates.
- three.js viewer; STEP files are read in the browser with OpenCascade (occt-import-js, WebAssembly).
- Razorpay Checkout for coin packs, in ₹ for visitors in India and $ for everyone else.
- `motion` for interface animation.

## Run it locally

Needs Node 24 and Docker (Colima works).

```bash
npm install
supabase start                    # local Supabase on 127.0.0.1:54321; applies supabase/migrations
cp .env.example .env.local        # fill from `supabase status`
npm run dev                       # http://localhost:3000
```

Google sign-in can't run on localhost without OAuth credentials, so for local testing create users with
the admin API and set `DEV_LOGIN=1`; then `/dev-login?email=…&password=…&next=/convert` signs them in.
That route returns 404 in production builds.

## Pages

| Path            | What                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `/`             | landing page with the live 3D example, pricing with three sample parts   |
| `/login`        | Google sign-in                                                           |
| `/convert`      | upload a drawing                                                         |
| `/models/[id]`  | live status → quote → progress → 3D viewer, downloads, dimension check    |
| `/history`      | every model, with thumbnails                                             |
| `/coins`        | balance, packs (Razorpay), ledger                                        |
| `/admin`        | owner panel: price, publish, fail, give coins                            |
| `/privacy`, `/terms` | drafts, to be reviewed by a lawyer before launch                    |

## Prices

The database is the source of truth: `tiers` (coins per part) and `coin_packs` (₹ in paise, $ in cents),
seeded in the first migration. Change them with SQL; the site picks them up within an hour.
`src/lib/pricing.ts` only holds fallbacks for when the database can't be reached.

## Sample parts

`npm run examples` rebuilds `public/examples/*` (STEP, preview GLB, drawing data, facts) from
`tools/examples/build_examples.py`. It needs the Python venv in `tools/.venv` with `build123d` and
`trimesh` installed.

## Going live

1. **Supabase**: create the project, link it (`supabase link`), push the migrations (`supabase db push`).
   - Authentication → Sign In / Providers: turn **Email off** and **Google on** (client ID and secret from
     Google Cloud → APIs & Services → Credentials → OAuth client, type Web; authorised redirect URI
     `https://<project-ref>.supabase.co/auth/v1/callback`).
   - Authentication → URL configuration: Site URL = the live domain; redirect URLs =
     `https://<domain>/auth/callback` and `http://localhost:3000/auth/callback`.
   - The owner is whoever signs in with Google as an address listed in `public.admins`.
2. **Razorpay**: API keys into `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Add a webhook to
   `https://<domain>/api/razorpay/webhook` for `payment.captured` and `payment.failed`, with a secret in
   `RAZORPAY_WEBHOOK_SECRET`. Charging in $ needs international payments enabled on the Razorpay account.
3. **Vercel**: set the variables from `.env.example`, deploy, add the domain.
