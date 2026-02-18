# Permission Surface v0 (what can be governed, what cannot)

This document defines the **minimum permission surface** for Mr.Market and its surrounding components.

Goal: make “legal-by-design / control-point minimization” concrete by explicitly stating:

- what actions are **possible** (and by whom)
- what actions are **intentionally impossible** (or must be cryptographically/verifiably constrained)
- what the **upgrade paths** are (and what artifacts exist when upgrades happen)

This is a v0: it is meant to be precise enough to audit and to guide engineering gates/tests.

---

## 1) Roles (today)

### 1.1 End user

A user can:

- create a market making order (funds in)
- stop/pause/resume/exit their own order
- view order status/metrics

A user cannot:

- directly access exchange API keys
- trigger privileged admin endpoints

### 1.2 Admin operator (Mr.Market backend)

Today there is an **admin** (JWT protected HTTP endpoints). Admin can:

- manage supported exchanges and trading pairs (enable/disable)
- manage stored exchange API keys (by reference id)
- start/stop certain strategies via admin endpoints (where implemented)

Admin must not be able to:

- “manually” move user funds without leaving durable, queryable audit trails
- inject raw exchange key/secret via request payloads (HTTP validation must reject)

### 1.3 Future: Verified node operator (TEE / EasyEnclave)

Long-term, the system should support independent node operators and ensure:

- secrets only provision after **TEE attestation** and an **MRTD allowlist**
- execution identity is verifiable (reports bound to attestation)

---

## 2) Permission surface: off-chain (Mr.Market)

### 2.1 Config flags (deployment-time)

These are **operator-controlled** deployment flags (env/config). They are a permission surface because they can change real-world behavior.

Current examples (server config):

- `strategy.queue_withdraw_on_payment_complete`
  - allows the system to queue withdraw jobs after payment completes
- `strategy.withdraw_to_exchange_enabled`
  - enables/disables live withdrawals to exchange

Policy:

- flags that materially affect user funds MUST be:
  - visible in audit logs when they gate execution paths
  - safe-by-default in new environments
  - covered by tests for “disabled => no outbound transfer” behavior

### 2.2 Admin HTTP endpoints

Admin endpoints exist and are protected by JWT auth.

Policy:

- endpoints that accept request bodies MUST use strict validation (whitelist + forbid non-whitelisted)
- any endpoint that can change trading/execution behavior MUST emit structured audit logs

### 2.3 Exchange API keys

Exchange keys are a critical permission surface.

Current policy (already implemented in parts):

- market-making flows should reference stored `api_key_id` / DB lookups
- inbound payloads must not contain raw key/secret

Future policy:

- keys are not usable unless bound to verified execution identity (TEE attestation)
- key usage must be attributable via logs + durable state transitions

### 2.4 Funds movement (Mixin → Exchange)

Funds movement steps (high-level):

- payment complete
- withdraw to exchange (gated)
- monitor withdrawal
- monitor exchange deposit

Policy:

- every step MUST be idempotent (jobId / durable state)
- every step MUST include a `traceId` and persist relevant identifiers (request id, tx hashes)
- if withdrawals are disabled, the system must **refund** (or fail safely) with auditable reasoning

---

## 3) Permission surface: on-chain (HuFi / Campaigns)

Mr.Market should treat the on-chain layer as the **rule source**.

Policy:

- reward rules should be reproducible from public inputs
- any “join campaign” semantics must be explicitly documented and code must match policy

---

## 4) What cannot be governed (non-negotiables)

These are “hard constraints” we are building towards:

- No identifiable market-making controller: execution must be attributable to immutable rules + verifiable nodes.
- No yield / price-support promises in UI or docs.
- Critical flows must be auditable + replayable.
- Secrets must not move without verification (TEE attestation + MRTD allowlist).

In other words: governance may exist for **operational configuration**, but not for **manual price control** or hidden discretionary intervention.

---

## 5) Upgrade paths (and required artifacts)

### 5.1 Backend (Mr.Market server)

Upgrade mechanism today:

- standard code deployment (Docker image / process restart)
- DB migrations (where applicable)

Required artifacts:

- version logged in structured audit context
- changelog/release notes (at least internal)

### 5.2 Execution identity (future)

When running inside TEE:

- upgrades must change measurement (MRTD)
- only allowlisted measurements may receive secrets

---

## 6) Engineering DoD for “permission surface”

This item is considered “done” when:

- this document exists and is referenced from `docs/TODO.md`
- the major permission surfaces are listed (admin endpoints, config flags, exchange keys, funds movement)
- engineering issues are opened/linked for any missing enforcement gates
