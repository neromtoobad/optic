# DEPLOY.md — Railway

Repo is deploy-ready: Dockerfile (node:20, native prebuilds for better-sqlite3 +
resvg), railway.json (health check on /v1/health), volume-aware paths.

## One-time dashboard steps

1. **Push the repo to GitHub** (private is fine):
   `gh repo create optic --private --source . --push` — or create empty repo + `git remote add origin … && git push -u origin main`.
2. Railway dashboard → **New Project → Deploy from GitHub repo** → pick `optic`.
   Railway detects the Dockerfile automatically (railway.json pins it).
3. Service → **Settings → Networking → Generate Domain** (or attach your own
   domain; add the CNAME Railway shows you at your DNS provider).
4. Service → **Settings → Volumes → Add Volume**:
   - Mount path: `/data`
   - This holds SQLite + rendered cards; without it every deploy wipes reads and cards.
5. Service → **Variables** → add (Raw Editor is fastest — paste all at once):

   ```
   OKX_API_KEY=<from your .env>
   OKX_SECRET_KEY=<from your .env>
   OKX_PASSPHRASE=<from your .env — passphrase contains #, Railway raw editor takes it literally, no quotes needed>
   VENICE_API_KEY=<from your .env>
   ANTHROPIC_API_KEY=<from your .env>
   PRICE_USDT=1
   READ_BUDGET_USD=0.30
   PAYOUT_ADDRESS=            # fill when the X Layer wallet exists
   DATABASE_PATH=/data/optic.db
   CARDS_DIR=/data/cards
   PUBLIC_BASE_URL=https://<your-domain>
   CACHE_TTL_SECONDS=600
   PAYMENTS_ENFORCED=false    # flips to true after Phase 4 goes live
   ```

   (PORT is injected by Railway automatically; the server reads it.)
6. **Deploy** fires on push. Watch Build Logs; first build ~2-4 min.
7. Verify from your machine:

   ```
   ./scripts/smoke.sh https://<your-domain>
   ```

   Expect: health JSON → 405 → full verdict with card_url. Then open
   `https://<your-domain>/v1/card/<id from the verdict>` in a browser — the
   card PNG should render (may take ~15-30s after the verdict if Venice was slow).

## Gotchas we already handled in code

- PORT from env, binds 0.0.0.0 (Railway requirement)
- SQLite + cards on /data volume (survive deploys)
- Health check path /v1/health with 120s timeout (first boot compiles nothing, it's fast)
- Fonts/fixtures copied into the image (satori reads assets/fonts from cwd)
- Egress needed to: web3.okx.com, gamma-api.polymarket.com, api.venice.ai,
  api.anthropic.com — Railway has open egress by default, nothing to configure.

## After deploy

- Paste the smoke.sh output back into the chat — the deploy isn't "done" until
  the live smoke passes (execution plan gate).
- Set PUBLIC_BASE_URL before sharing any card links (it's baked into card_url).
