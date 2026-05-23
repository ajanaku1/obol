# Deploying Obol on Hugging Face Spaces (free, no card)

Hugging Face Spaces runs a Docker container with a public HTTPS URL, for free,
with no credit card. The URL stays up even when your machine is off. Obol's
agent runs as a child process inside the container and the SQLite ledger lives
in `/tmp`, so the whole app runs in one container.

## 1. Create the Space (one time)

1. Sign up at https://huggingface.co (free, no card).
2. **New → Space.** Choose:
   - **SDK: Docker**, template **Blank**.
   - Hardware: **CPU basic** (free).
   - Name it `obol`.
3. HF creates the Space with a `README.md` containing YAML front-matter. Make
   sure it includes:
   ```yaml
   ---
   title: Obol
   sdk: docker
   app_port: 7860
   ---
   ```
   (`app_port: 7860` is what makes HF route the public URL to the web app.)

## 2. Add secrets (one time)

In the Space: **Settings → Variables and secrets → New secret.** Add each as a
**secret** (not a public variable):

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ARC_RPC_URL` | your Arc RPC URL (the dedicated `arc-canteen` one) |
| `ARC_USDC_ADDRESS` | `0x3600000000000000000000000000000000000000` |
| `OBOL_WALLET_PRIVATE_KEY` | Obol's testnet wallet key |
| `VENDOR_PAYOUT_ADDRESS` | the vendor payout address |
| `TAVILY_API_KEY` | your Tavily key |

HF injects these as environment variables into the container.

## 3. Push Obol's code into the Space

From your machine, copy the project into the Space repo (keeping the Space's
own README with its front-matter):

```bash
git clone https://huggingface.co/spaces/<your-hf-user>/obol obol-space
rsync -a --exclude .git --exclude README.md --exclude node_modules \
  --exclude .next --exclude .env --exclude data \
  /Users/mac/Vibecoding/obol/ obol-space/
cd obol-space
git add -A
git commit -m "Add Obol"
git push
```

HF builds the `Dockerfile` automatically. Watch the build logs in the Space.
First build takes a few minutes (it compiles `better-sqlite3` and runs
`next build`).

## 4. Fund the wallet

Obol fronts every run from its Gateway balance, so fund it before demoing:

```bash
# locally, with the same wallet key as the Space secret:
npm run gateway:deposit --workspace=@obol/payments -- 3.00
```

## 5. Go live

When the build finishes, the Space is live at:

```
https://<your-hf-user>-obol.hf.space
```

Set it as the repo homepage:

```bash
gh repo edit ajanaku1/obol --homepage "https://<your-hf-user>-obol.hf.space"
```

## Notes

- **Public + shared purse.** Anyone can run a query, and Obol fronts the cost
  from one shared Gateway balance. The per-query cap ($0.10) and the empty-purse
  guard limit the damage, but keep the funded balance small for a public demo.
- **Ephemeral ledger.** `/tmp` resets when the Space rebuilds or restarts; run
  history is not persistent. That's fine for a demo. For persistence, add HF
  persistent storage and point `OBOL_DB_PATH` at it.
- **Sleep.** Free Spaces pause after extended inactivity and wake on the next
  visit (a short cold start).
- **Updating.** Re-run the `rsync` + `git push` from step 3.
