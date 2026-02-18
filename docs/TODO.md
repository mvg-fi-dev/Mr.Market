# Mr.Market — TODO (soul-aligned)

> See also: `docs/plans/2026-02-17-vision-layer-todo.md` for the full phased vision across **HuFi (protocol)** + **Mr.Market (execution/product)** + **EasyEnclave (trust/TEE)**.

This TODO is intentionally organized to match the project soul:

- **Liquidity is a protocol capability** (not a permissioned privilege).
- We aim for **unmanipulable-by-default** systems: fewer control points, rules locked, execution verifiable.
- This is **not** “unregulated”; it is “hard to manipulate”: transparent, auditable, defensible.

---

## 0) Non‑negotiables (Legal-by-design / control-point minimization)

_DoD: written permission model + enforced gates in code (tests), so operators cannot “just do it manually” without leaving an audit trail._

- [ ] Define and publish the **permission surface** (what can be governed, what cannot, upgrade paths). (docs: `docs/thesis/*`, `docs/plans/2026-02-17-vision-layer-todo.md`)
- [ ] No identifiable market-making controller: execution attributable to **immutable rules + verifiable nodes**. (future: `repos/easyenclave/*` integration; docs: `docs/plans/2026-02-17-hufi-mrmarket-easyenclave-architecture.md`)
- [ ] No yield / price-support promises in UI/docs; dashboards are **measurement**, not marketing. (interface: `interface/src/i18n/*`, `interface/src/lib/components/**`)
- [ ] Every critical flow is **auditable + replayable** (traceId, structured logs, durable state transitions, idempotency keys). (server: `server/src/modules/infrastructure/logger/*`, `server/src/modules/market-making/durability/*`)
- [ ] **Secrets never move** without verification: exchange keys / signing keys provisioned only after **TEE attestation + MRTD allowlist** (EasyEnclave). (current keys: `server/src/modules/mixin/exchange/*`; future: `repos/easyenclave/*`)

---

## 1) P0 — Make the loop real (funds → exchange → run → report)

### 1.1 Payment → withdraw → deposit confirm → start MM

_DoD: with withdrawal enabled in a staging environment, a fresh order can reach `running` end-to-end; on retries/restarts it remains idempotent and fully traceable._

- [x] User can open invoice payment page in confirm payment step. (interface: `interface/src/lib/components/grow/marketMaking/createNew/confirmation/*`)
- [x] Invoice payment can be handled correctly by backend. (server: `server/src/modules/mixin/snapshots/*`, `server/src/modules/market-making/user-orders/*`)

- [x] Withdraw-to-exchange flow implemented (config-gated). (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`, `server/src/modules/mixin/withdrawal/*`)
  - Notes:
    - Withdrawal queueing is gated by `strategy.queue_withdraw_on_payment_complete`. (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`)
    - Live withdrawals are gated by `strategy.withdraw_to_exchange_enabled`. (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`)
  - [x] DB-only exchange API key lookup for MM flows (no raw key/secret in request payloads for queue handlers). (server: `server/src/modules/mixin/exchange/exchange.service.ts`, `server/src/modules/market-making/user-orders/market-making.processor.ts`)
  - [x] Add audit log fields consistently (exchange, api_key_id, order_id, traceId). (server: `server/src/modules/infrastructure/logger/*`, MM queue processors)
  - [x] Add request validation at the HTTP boundary: reject inbound payloads that include raw exchange key/secret fields; only allow referencing stored `api_key_id` (if/where applicable). (server controllers + DTOs)

- [x] Exchange deposit confirmation tracking (MEXC-only today). (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`, `server/src/modules/market-making/network-mapping/*`)
  - Notes:
    - Polling-based (near real-time), not websocket-driven.
  - [x] Propagate correlation/tracing id across `withdraw_to_exchange -> monitor_mixin_withdrawal -> monitor_exchange_deposit`. (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`)
  - [x] Extend `monitor_exchange_deposit` beyond MEXC (per-exchange matching rules for `network`, `txid`, amount tolerance). (server: `server/src/modules/mixin/exchange/exchange.service.ts`, MM deposit monitor)
  - [x] Add reconciliation job: periodic refresh + repair missed events. (server: `server/src/modules/market-making/reconciliation/*`)

- [x] Start MM automatically after deposit confirmation. (server: `server/src/modules/market-making/user-orders/market-making.processor.ts`)
  - Current behavior: `deposit_confirmed -> start_mm` is queued; `join_campaign` is optional and must not block start.

### 1.2 Stop / exit / withdrawals (user safety)

_DoD: exit is safe, bounded, and idempotent; no cross-order balance leakage; every fund movement has a ledger entry and traceId._

- [x] Define idempotency + retry rules for stop/exit state transitions (avoid double-withdraw / double-start). (server: `server/src/modules/market-making/user-orders/*`, `server/src/modules/market-making/ledger/*`)
  - Implemented: controller methods now dedupe by jobId+`queue.getJob(jobId)` (stop/pause/resume/exit) and `exitMarketMaking` will not regress `exit_*` states back to `exit_requested`.
  - Remaining: exchange withdrawal idempotency should be made durable (persist withdrawal request/tx hashes to avoid re-withdraw on crash mid-exit).
- [x] Document failure-mode handling: exchange downtime/timeouts, insufficient balance, partial fills. (docs: `docs/execution/flow/MARKET_MAKING_FLOW.md`, `docs/tests/MARKET_MAKING.md`)

### 1.3 Campaign join semantics (explicit decision)

_DoD: one written policy + state diagram; code matches policy (tests), and UI text matches reality._

- [ ] Decide whether `join_campaign` is a required step or optional bookkeeping. (server: `server/src/modules/campaign/*`, `server/src/modules/market-making/user-orders/market-making.processor.ts`)
  - Current behavior: HuFi join is handled by CampaignService cron; `deposit_confirmed` queues `start_mm` directly.
- [ ] If required: define `deposit_confirmed -> join_campaign` enqueue rules (idempotent), and store idempotency keys (`order_id + step_name`). (server: MM queue + DB)

---

## 2) P0 — Make it measurable (transparency as trust)

### 2.1 Execution reporting (measurement, not marketing)

_DoD: given an orderId and time window, we can produce a reproducible report bundle referencing raw exchange facts._

- [ ] Execution report v0: per-order periodic metrics snapshot + audit fields + references to exchange facts. (server: `server/src/modules/market-making/metrics/*`, `server/src/modules/market-making/performance/*`)
- [ ] Order lifecycle transparency: place/cancel logs, fills, active orders, error taxonomy, safe retries. (server: `server/src/modules/market-making/trade/*`, `server/src/modules/market-making/trackers/*`)
- [ ] Profit/balance tracking v0: realized/unrealized PnL (even if not paid out), volume, counts. (server: `server/src/modules/market-making/ledger/*`, `server/src/modules/market-making/performance/performance.service.ts`)
- [ ] Risk controls v0: max exposure, max order count, kill-switch, price sanity checks. (server: `server/src/modules/market-making/strategy/*`, `server/src/modules/market-making/orchestration/*`)

### 2.2 Observability & ops

_DoD: one admin page shows system health; on-call can answer “is the loop running, is it verified, and what is broken?”_ 

- [ ] Standardize structured logging fields (campaign_id, order_id, job_id, chain_id, exchange, version). (server: `server/src/modules/infrastructure/logger/*`)
- [ ] Add tracing/correlation IDs across Mr.Market -> executor -> HuFi components. (server: queue payloads + HTTP clients)
- [ ] Admin “system status” page: queue health, executor health, HuFi reachability, EasyEnclave verification status. (server: `server/src/modules/infrastructure/health/*`; interface: `interface/src/lib/components/admin/health/*`)

---

## 3) P0 — Participation UX (“why users use us”)

### 3.1 Token creators

_DoD: a creator can see liquidity is live, measurable, and verifiable—without trusting a human operator._

- [ ] “Launch with liquidity” happy-path demo: fund -> deposit confirmed -> start MM -> **public proof page**. (interface routes: `interface/src/routes/(bottomNav)/(market-making)/*`)
- [ ] Creator dashboard: depth, spread/range, volume, reward spend, node count, verification status. (interface: `interface/src/lib/components/market-making/*`, server: metrics/perf)
- [ ] Strategy templates/presets: stable depth / high volatility / market-cap defense / low-maintenance. (server: `server/src/modules/market-making/strategy/*`, interface: create-new flow)
- [ ] Public, verifiable “no-admin / no-manipulation” proof bundle (rules summary + contract locks + attestation status). (docs + interface)

### 3.2 Node operators

_DoD: a third-party operator can deploy a node and prove what code is running (attested identity), and see earnings/risk._

- [ ] One-command node deployment (Docker), minimal config, auto-update story. (ops/docs)
- [ ] Earnings + risk panel: active campaigns, estimated rewards, exposure, utilization, alerts. (server: performance/rewards; interface: admin/dashboard)
- [ ] Verifiable execution identity: TEE attestation status, MRTD, proof-of-execution artifacts. (future: `repos/easyenclave/*` integration)

### 3.3 Traders / public trust

_DoD: a public page can show “depth is real” with methodology and verifiable status—not claims._

- [ ] “Depth is real” page: methodology + live verification status + data transparency. (interface)
- [ ] Stability report: liquidity uptime, spread stability, depth volatility/drawdown. (server: metrics/perf)

---

## 4) P1 — HuFi integration (protocol-aligned rewards)

_DoD: the reward calculation is reproducible and auditable; no “trust me” payout runs._

- [ ] Campaign discovery UX + linking: show which campaign an order participates in. (server: `server/src/modules/campaign/*`; interface: HuFi pages)
- [ ] Reward pipeline v0: compute reward based on performance and publish a reproducible manifest. (server: `server/src/modules/market-making/rewards/reward-pipeline.service.ts`)
- [ ] Recording submission/pull model decision: what reports are submitted to HuFi and how they’re verified. (docs + HuFi API integration)

---

## 5) P1 — EasyEnclave / TEE execution (remove identifiable controller)

_DoD: secrets are provisioned only after verification; every report can be bound to an attested code measurement._

- [ ] Define what must be inside TEE vs outside (threat-model driven). (docs)
- [ ] Package executor service in TDX (stable MRTD per build; reproducible builds). (future: executor package)
- [ ] Service discovery + routing via EasyEnclave. (future: `repos/easyenclave/*` integration)
- [ ] Enforce MRTD allowlist before provisioning any exchange secrets. (future: EasyEnclave policy)
- [ ] Bind reports to attestation identity (proof-of-execution artifact format). (docs + report pipeline)

---

## 6) P1 — Abuse resistance (must not become a reward-farming game)

_DoD: the system penalizes obvious abuse patterns and publishes auditable inputs for disputes._

- [ ] Anti-abuse baseline: self-trade / wash / spoof-like cancel heuristics and penalties. (server: HuFi scoring + MM trackers)
- [ ] Reputation inputs: uptime, report quality, deviation detection. (server: metrics/perf)

---

## Interface

### Connect payment state to confirm payment page
- [x] after user clicked pay button in create-new market making page, should start loading and fetch payment status from backend (interface: `interface/src/lib/components/grow/marketMaking/createNew/confirmation/*`, helper: `interface/src/lib/helpers/mrm/marketMakingPayment.ts`)
- [x] after payment status fetched, should show payment successful, and redirect to order details page (interface)
- [x] order details page should fetch order details from backend, and show order details (connect ui to backend) (interface: `interface/src/routes/(secondary)/(market_making)/market-making/orders/[id]/+page.svelte`)
- [x] make sure order details page is connected to backend correctly (interface)

### Create market making UI
- [x] when select trading pair, there should be an small icon that represents the chain of the asset (interface: `interface/src/lib/components/grow/marketMaking/createNew/*`)

### Admin page
- [ ] Add a setup guide for initialization that is step by step (docs + interface: `interface/src/lib/components/admin/settings/*`)
- [ ] Support sorting and filter in manage market making pairs/spot trading pairs (interface: `interface/src/lib/components/admin/*`)

### Admin exchanges management
- [ ] Merge /exchanges and /api-keys UX: manage API keys in the exchange flow so users don’t get confused (interface: `interface/src/lib/components/admin/exchanges/*`)

### E2e Test
- [x] Create market making UI
- [x] Admin add trading pairs
- [x] Admin add exchanges

---

## HuFi (in Mr.Market UI)

### Campaigns
- [-] Mr.Market users can see all campaigns, and specific campaign details under /market-making/hufi (interface: `interface/src/lib/components/grow/marketMaking/hufi/*`)
- [ ] Mr.Market users should see volume created by HuFi campaigns (interface + server metrics)
- [ ] Mr.Market users can create campaigns with mixin wallet under /market-making/hufi
- [ ] Mr.Market users can join HuFi campaigns by creating market making orders with mixin wallet under /market-making/hufi
- [ ] Mr.Market users can see joined HuFi campaigns (via market making orders) under /market-making/hufi
- [ ] Mr.Market users can see their created campaigns with mixin wallet under /market-making/hufi

- [ ] Mr.Market users can create campaigns with evm wallets (including mixin evm wallet) under /market-making/hufi
- [ ] Mr.Market users can join HuFi campaigns by creating market making orders with evm wallets under /market-making/hufi
- [ ] Mr.Market users can see joined HuFi campaigns with evm wallets under /market-making/hufi
- [ ] Mr.Market users can see their created campaigns with evm wallets under /market-making/hufi

- [ ] HuFi Learn more page should introduce each types of campaigns
- [ ] HuFi campaigns page should have a filter button on top (type, create/end date, sort, reward amount)
- [ ] Different campaign types should have different actions in details page
