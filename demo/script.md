# Demo script: 3 minutes

A guided walkthrough of one real Obol run, end to end. Record three takes and
keep the cleanest. Have the data market and the frontend already running, and
Obol's Gateway balance funded.

## 0:00 The idea (20s)

> "This is Obol. You give it a question and a ceiling, the most you'd pay. It
> goes and *buys* the answer, paying real micropayments to data vendors on Arc.
> You don't pay up front. Obol fronts the cost, and you only pay if it
> delivers."

Show the landing page. One sentence on the name: the obol was the small coin
of the Athenian agora.

## 0:20 Ask (20s)

Type the corroboration query from `sample-queries.md` (the Circle/USDC one
reads best). Set the ceiling to $0.04. Click *Send Obol to the market*. No
wallet prompt yet.

> "I haven't told it which sources to use, and I haven't paid anything."

## 0:40 Watch it reason (50s)

Narrate the work log as it fills:

- **Discovery:** "First it surveys the market, seven priced vendors."
- **Decision:** "It reasons about which ones the question needs, and escalates
  to peer-reviewed research and SEC filings to corroborate."
- **Payment:** "Here it pays vendors through Circle Nanopayments, sub-cent USDC
  on Arc, gasless and batched."
- The **spend meter** climbing, staying under the ceiling.

> "Every line is a decision it made on its own: what to buy, in what order, and
> when to stop."

## 1:30 The answer is locked (30s)

When the run finishes, the answer comes back **locked**:

> "It found an answer, and it fronted the cost to get it. Now it shows the
> receipt: every vendor it paid and what it spent. The answer is locked behind
> one payment, what it spent plus 15%."

## 2:00 Pay to unlock (30s)

Connect the wallet, click *Pay and unlock*, approve the USDC payment.

> "One payment to Obol, verified on Arc, and the answer unlocks. Obol just
> earned a margin on work it did autonomously. It's a business, not a faucet."

The full answer reveals, with its multi-source corroboration.

## 2:30 Why it's different (30s)

> "Most agent demos spend a pre-funded budget and call it done. Obol is the
> smallest unit of an agentic economy: it discovers a market, fronts capital,
> procures under budget, and bills cost-plus on delivery, all settled in USDC
> on Arc through Circle Nanopayments."

End on the live link.

## Checklist

- [ ] Obol's Gateway balance funded; confirmed with `wallet:status`.
- [ ] Data market running on :4020; frontend on :3000. No facilitator needed.
- [ ] A wallet connected on Arc testnet with USDC for the unlock payment.
- [ ] A clean run rehearsed; know which vendors the question pulls.
- [ ] Under 3:00.
