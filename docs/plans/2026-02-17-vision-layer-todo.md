# Vision Layer TODO (Protocol / Execution / Participation)

This document is a comprehensive TODO plan organized by implementation phases.

Goal: deliver the three-layer vision described in the thesis/technical doc:
- Layer 1: Protocol Layer (on-chain rules + campaigns + settlement)
- Layer 2: Execution Layer (distributed market-making execution, TEE-attested)
- Layer 3: Participation Layer (creator + operator + user UX)

Scope: HuFi + Mr.Market + EasyEnclave.

Notes:
- HuFi = campaign + recording + payout stack.
- Mr.Market = product shell + funds/orchestration + exchange execution engine.
- EasyEnclave = TEE attestation + service discovery + verified routing (TDX).

---

## Phase 0 — Foundations (shared prerequisites)

### 0.1 Architecture + boundaries
- [ ] Define “what must be inside TEE” vs “what can be outside” (threat model driven)
  - Acceptance: written threat model + explicit list of secrets handled by each component.
- [ ] Define minimal cross-service contracts (API + message schemas)
  - Acceptance: versioned API spec for mm-executor + reporting.
- [ ] Define environment separation: dev / staging / prod
  - Acceptance: documented environments and which chains/exchanges are used where.

### 0.2 Observability + audit
- [ ] Standardize structured logging fields across all services (campaign_id, order_id, job_id, chain_id, exchange, mrt d/version)
- [ ] Add tracing/correlation IDs across Mr.Market -> executor -> HuFi Oracles
- [ ] Add a single “system status” dashboard page in Mr.Market admin
  - Shows: queue health, executor health, HuFi API reachability, EasyEnclave verification status.

### 0.3 Keys + secrets lifecycle (non-negotiable)
- [ ] Define read-only exchange API key lifecycle:
  - enrollment
  - storage
  - provisioning to executor
  - rotation
  - revocation
- [ ] Define signing keys for “report signatures” (if used): generation + rotation + binding to attestation
- [ ] Define wallet key management for on-chain actions (HuFi join/payout interactions)

---

## Phase 1 — Protocol Layer MVP (HuFi-aligned, audit-first)

Objective: a campaign can be created, joined, measured, and paid out with minimal trust and clear audit trails.

### 1.1 Campaign contract model (HuFi / Protocol)
- [ ] Confirm contract invariants for “No admin / minimal governance”
  - Acceptance: documented permission surface + list of upgrade keys (if any).
- [ ] Factory -> immutable campaign creation flow
  - Acceptance: campaign parameters locked; only predefined actions allowed.
- [ ] Campaign metadata schema (token, exchange, pair, duration, reward budget, scoring params)

### 1.2 Reward model v0 (anti-abuse baseline)
- [ ] Choose v0 payout philosophy:
  - Rewards-only (recommended for MVP) OR PnL-sharing
- [ ] Define scoring inputs and minimum anti-abuse checks
  - Candidate inputs: effective volume, time-on-book, depth-at-spread, volatility-adjusted contribution.
  - Candidate checks: self-trade detection, wash patterns, spoof-like cancels.
- [ ] Specify what is verified on-chain vs off-chain
  - Acceptance: explicit list of on-chain verifiable fields + off-chain proofs/audit artifacts.

### 1.3 Recording Oracle extensions (HuFi)
- [ ] Implement/confirm endpoints needed for:
  - executor identity registration (attestation reference)
  - result submission (or pull-based data collection)
  - campaign participant status queries
- [ ] Add deterministic “results bundle” format
  - Contains: raw exchange facts (or references), computed metrics, digests, timestamps.

### 1.4 Reputation Oracle payout reproducibility
- [ ] Ensure payout run is reproducible:
  - pin dependencies
  - deterministic sorting
  - write payout manifest to storage
  - publish hash of payout manifest

---

## Phase 2 — Execution Layer MVP (Mr.Market core loop: funds -> exchange -> run -> report)

Objective: make the market-making loop real and reliable before making it decentralized.

### 2.1 Funds flow completion (Mr.Market)
- [ ] Withdraw-to-exchange (real mode)
  - Acceptance: funds move from custody to exchange for a given order.
- [ ] Deposit confirmation tracking
  - Acceptance: detect arrival and update order state in near real-time.
- [ ] Start market making automatically after deposit confirmation
- [ ] Stop market making and withdraw-back flow
  - Acceptance: stop endpoint triggers cancel orders, settles positions, and returns funds.
- [ ] Failure modes + recovery:
  - exchange downtime
  - partial fills
  - insufficient balance
  - network timeouts
  - idempotency on retries

### 2.2 Market-making engine v0 (Mr.Market)
- [ ] Define “strategy contract” interface (pluggable strategy modules)
- [ ] Implement a minimal baseline strategy:
  - constant spread + inventory caps + refresh cadence
- [ ] Order lifecycle tracker:
  - place/cancel logs
  - filled amount
  - active orders
  - realized/unrealized PnL (even if not paid out)
- [ ] Risk controls:
  - max exposure
  - max order count
  - kill-switch
  - price sanity checks (VWAP/oracle bounds)

### 2.3 Reporting pipeline v0
- [ ] Produce periodic execution reports:
  - metrics snapshots
  - signed digest (optional)
  - references to exchange facts
- [ ] Submit reports to HuFi Recording Oracle (or make them pullable)

---

## Phase 3 — TEE + Distributed Execution (EasyEnclave integration)

Objective: make execution verifiable and remove a single trusted operator.

### 3.1 EasyEnclave control plane deployment (infra)
- [ ] Deploy EasyEnclave (control plane + agents) in target environment
- [ ] Configure Intel Trust Authority verification
- [ ] Define service taxonomy:
  - service name: `mm-executor`
  - tags: exchange, region, node_size, environment

### 3.2 Executor service inside TDX (mm-executor)
- [ ] Package mm-executor as a TDX-attested service
  - Acceptance: has stable MRTD per build; reproducible builds verified.
- [ ] Expose minimal HTTP API (versioned):
  - `POST /v1/jobs/start`
  - `POST /v1/jobs/stop`
  - `GET /v1/jobs/{id}/status`
  - `GET /v1/jobs/{id}/report`
- [ ] Build-time + runtime configuration policy
  - what is baked in image vs provided at runtime

### 3.3 Mr.Market -> EasyEnclave routing + policy
- [ ] Discover executor services via EasyEnclave
- [ ] Verify control plane attestation before any routing
- [ ] Enforce MRTD allowlist (only approved executor builds)
- [ ] Add executor selection policy:
  - simple (round-robin) -> later (capacity-aware + reputation-aware)

### 3.4 Secrets provisioning to TEE (hard requirement)
- [ ] Do not send exchange secrets unless:
  - EasyEnclave verification passes
  - executor attestation verifies
  - MRTD allowlisted
- [ ] Decide secret provisioning design:
  - short-lived per-job credentials OR encrypted blob sealed to TEE identity
- [ ] Implement revocation path (immediate disable)

### 3.5 Binding results to attestation
- [ ] Ensure each report is linkable to:
  - executor identity
  - attestation / MRTD
  - job_id
  - time window
- [ ] Define “proof-of-execution” artifact format
  - Acceptance: HuFi can store or reference it for audits.

---

## Phase 4 — Participation Layer (product UX: creators, operators, users)

Objective: make “launch with liquidity” a default, low-friction experience.

### 4.1 Creator UX (token issuer / campaign creator)
- [ ] 5-minute flow: create campaign -> fund -> active liquidity
- [ ] Campaign templates (presets):
  - stable depth
  - high volatility
  - market-cap defense
  - low-cost maintenance
- [ ] Public campaign page:
  - current depth
  - node count
  - reward budget remaining
  - rules summary (no-admin proof where possible)

### 4.2 Operator UX (node runners)
- [ ] One-command deployment guide for:
  - Mr.Market
  - EasyEnclave agent/executor (if self-hosted)
- [ ] Earnings + risk panel:
  - active campaigns
  - estimated rewards
  - exposure
  - alerts (downtime, errors)
- [ ] Auto-optimization (later):
  - auto-join best campaigns
  - auto-stop low reward or high risk

### 4.3 Trader UX (public trust)
- [ ] “depth is real” proof page:
  - explain methodology
  - show verification status (attested executors)
- [ ] Stability reports:
  - liquidity uptime
  - spread stability
  - drawdown/volatility of depth

---

## Phase 5 — Abuse resistance + reputation (must-have for sustainability)

Objective: prevent the system from degenerating into reward farming.

### 5.1 Sybil resistance (execution network)
- [ ] Node identity model:
  - attestation identity
  - optional stake/bond (if desired)
  - rate limits per identity
- [ ] Reputation scoring:
  - uptime
  - report quality
  - deviation from expected behavior

### 5.2 Wash/self-trade and spoof resistance
- [ ] Exchange-level heuristics (recording oracle)
- [ ] Penalize behaviors:
  - self-trade patterns
  - high cancel rate without contribution
  - quote stuffing

### 5.3 Dispute and audit flows
- [ ] Make every payout auditable:
  - publish inputs hash
  - publish results manifest
  - allow re-computation by third parties

---

## Phase 6 — Scale-out (multi-exchange, multi-chain, reliability)

### 6.1 Multi-exchange
- [ ] Exchange connector maturity tiers (supported / experimental / disabled)
- [ ] Per-exchange risk policies

### 6.2 Multi-chain campaign support
- [ ] Expand chain mapping and campaign compatibility
- [ ] Unified campaign discovery UI

### 6.3 Reliability engineering
- [ ] Chaos testing for:
  - exchange timeouts
  - partial fills
  - network partitions
- [ ] Backups + disaster recovery for state stores

---

## Immediate next actions (recommended order)

1) Phase 2.1: finish funds-to-exchange -> deposit confirm -> start mm (Mr.Market).
2) Phase 2.2: make a minimal strategy stable (1 exchange, 1 pair).
3) Phase 3.2: build mm-executor as a TDX-attested service and register it in EasyEnclave.
4) Phase 3.3/3.4: enforce attestation before provisioning any secrets.
5) Phase 1.2/5.x: lock a scoring model that is abuse-resistant enough for mainnet.
