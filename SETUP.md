# Obol Setup

This walks you from a clean machine to a funded Obol wallet on Arc testnet,
ready to run a query. Steps marked **(you)** need a browser or interactive
login and are run by you; everything else is a script.

## 0. Prerequisites

- Node.js 20+
- `uv` (for the Arc CLI): https://docs.astral.sh/uv/

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Leave the wallet fields blank for now; step 4 fills them in.

## 3. Arc testnet access **(you)**

1. Install the Arc CLI:
   ```bash
   uv tool install git+https://github.com/the-canteen-dev/ARC-cli
   ```
2. Get an Arc testnet RPC key from the Arc builder portal and put the RPC URL
   in `.env` as `ARC_RPC_URL`.
3. Find the Arc testnet USDC contract address and set `ARC_USDC_ADDRESS`.

## 4. Create Obol's wallet

```bash
npm run wallet:create
```

This generates a fresh keypair and writes it into `.env` (which is
git-ignored, so the private key never reaches a committable file). It prints
only the public address.

## 5. Fund the wallet **(you)**

1. Open https://faucet.circle.com and request testnet USDC for the address
   printed in step 4. Arc uses USDC as its native gas asset, so this single
   balance covers both gas and the micropayments Obol makes.
2. Confirm the funds landed:
   ```bash
   npm run wallet:status
   ```
   You can also view the wallet on https://testnet.arcscan.app.

## 6. Deposit into Circle Gateway

Obol pays through Circle Nanopayments, which draw from a Gateway balance, not
the wallet directly. Deposit once (the wallet keeps the rest for gas):

```bash
npm run gateway:deposit --workspace=@obol/payments -- 3.00
```

This signs an on-chain deposit into the Gateway Wallet and prints the new
Gateway available balance.

## 7. Run a query

Start the data market, then the agent (no facilitator to run; Circle Gateway
settles):

```bash
npm run start --workspace=@obol/data   # data market on :4020
npm run dev                            # frontend at http://localhost:3000
```

Or run a query straight from the terminal:

```bash
npm run agent -- --question "What is Ethereum and what is it trading at?" --budget 0.01
```

Enter a question and a USDC budget, and watch Obol shop the market.

---

**Definition of done for Day 1:** `npm run wallet:status` shows a funded
balance and the wallet is visible on `testnet.arcscan.app`.
