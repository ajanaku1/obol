# Sample queries

Questions that show Obol shopping the market well. Each one needs a different
vendor, or more than one, so the budgeting is visible. Set the ceiling a little
above the expected spend.

## Single-vendor, cheap (ceiling $0.01)

- *"What is Arc, the blockchain?"* uses one Entity Brief call.
- *"What's Ethereum trading at right now?"* uses one Market Data Terminal call.

Good for a fast demo: Obol surveys the market, picks the one cheap source that
fits, buys it, and stops with budget to spare.

## Two-vendor, corroborating (ceiling $0.02)

- *"Is Solana up or down today, and why?"* takes a Market Data Terminal call
  plus a Signal Feed read to explain the move.
- *"What's the weather in Lisbon, and is it a good day to be outside?"* takes a
  Location Intelligence call, then a judgement.

Shows Obol deciding one source isn't enough and buying a second.

## Canonical corroboration query (record the demo against this one)

- *"Is Circle's stablecoin reserve composition consistent with what independent
  research says about USDC backing?"* Entity Brief warms up on the issuer,
  **Filings Desk** pulls Circle's recent SEC disclosures, **Scholar Index**
  surfaces what the literature says, and **Deep Research** (Tavily) adds the
  current web consensus. Roughly $0.015 across three or four vendors. Use a
  ceiling of $0.04.

This query exercises the whole thesis in one run: genuine selection,
corroboration across evidence sources at adjacent prices, and a stop once the
answer is defensible.

## Filings, on its own (ceiling $0.02)

- *"What did Apple just file with the SEC?"* uses one **Filings Desk** call,
  returning the last few 10-K, 10-Q, and 8-K filings with links to the primary
  documents.

## Budget pressure (ceiling $0.01)

- Ask a broad question, like *"Give me a current briefing on the AI agent
  space"*, with a tight ceiling.

Shows the stop condition under pressure: Obol spends what it can, then returns
an honest answer with a note on what it could not afford to confirm.

## Pay nothing

- Ask something with no real sources, like *"What is the flonk velocity of a
  zorbletwidget?"* The vendors return empty, Obol is charged nothing, and there
  is nothing to unlock.

## What to point the camera at

1. The work log filling in as Obol discovers vendors and reasons.
2. The spend meter ticking up, staying under the ceiling.
3. The answer arriving **locked**, then revealing after the pay-to-unlock
   payment confirms on Arc.
