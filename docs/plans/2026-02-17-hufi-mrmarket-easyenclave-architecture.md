# HuFi + Mr.Market + EasyEnclave — Architecture and Responsibilities

This document explains how the HuFi protocol stack, Mr.Market, and EasyEnclave fit together.

Goal: build a market-making system where (1) campaigns and payouts are protocolized, (2) execution can run on distributed nodes, and (3) execution can be verified via TEE remote attestation.

## 1. Components (what each project is responsible for)

### HuFi (hufi monorepo)
HuFi provides the **campaign and reward settlement layer**.

Main responsibilities:
- Campaign lifecycle: create/discover/join campaigns.
- Participant enrollment and key management flows (via Recording Oracle).
- Performance recording, validation, and writing results to escrow/chain.
- Reward calculation + on-chain payouts (via Reputation Oracle).

Concrete services:
- Campaign Launcher (Client + Server)
- Recording Oracle (REST API + exchange data fetching/validation)
- Reputation Oracle (CLI / GitHub Action payout runner)

### Mr.Market (this repo)
Mr.Market provides the **execution product shell and automation**.

Main responsibilities:
- User product: deposits, orders, UI/admin, operational flows.
- Execution orchestration: decide what to run, when to start/stop, and how to recover.
- Exchange connectivity and strategy execution (market making engine).
- Integrate with HuFi:
  - fetch campaigns
  - join campaigns
  - submit read-only exchange credentials when appropriate

Important note:
- Mr.Market is the place where the “market-making loop” must become real: funding -> exchange -> execute -> report -> settle.
- This repo already contains a tick-driven + intent-driven MM engine foundation and a single-writer balance ledger foundation; the remaining gap is completing the real withdrawal/deposit-to-exchange lifecycle and production hardening.

### EasyEnclave (easyenclave/easyenclave)
EasyEnclave provides the **TEE trust and discovery control plane** for TDX-attested services.

Main responsibilities:
- Service registration + discovery with metadata (endpoints, tags, environment, MRTD).
- Remote attestation verification (Intel TDX) via Intel Trust Authority.
- Verified proxy routing: clients verify the control plane before sending sensitive requests.
- Reproducible build + measurement model (MRTD becomes the identity of “what code is running”).

Important note:
- EasyEnclave is not a market-making engine.
- It is the trust layer that lets you say: “this execution node is running the exact code version we expect”.

## 2. Mapping to the design layers

### Protocol Layer (campaigns + incentives + settlement)
Owned primarily by: **HuFi**
- Campaign parameters and rules
- Settlement/payout workflow
- Auditability/reproducibility (especially for payouts)

### Execution Layer (running strategies on exchanges)
Owned primarily by: **Mr.Market**
Hardened/verified by: **EasyEnclave**
- Market making logic, order lifecycle, risk controls
- Operational reliability (restarts, retries, monitoring)
- TEE attestation and “proof of what code ran”

### Participation Layer (UX for creators, operators, participants)
Owned primarily by: **Mr.Market** and **HuFi Campaign Launcher**
- Creator UX: launch/manage campaigns
- Participant UX: join campaigns, configure exchange access, monitor progress
- Operator UX: deploy and manage nodes/services

## 3. Trust model (why EasyEnclave matters)

Without TEE attestation, any execution node could claim results while running modified code.

With EasyEnclave, the system can:
- verify a node is a genuine TDX VM
- verify the node’s measurement (MRTD) matches an allowed build
- only send sensitive material (keys/tasks) after verification
- bind reported results to an attested code version

This turns “execution is distributed” into “execution is distributed and verifiable”.

## 4. High-level flow (end-to-end)

A minimal end-to-end flow looks like this:

1) Campaign exists (HuFi)
- Creator launches a campaign using HuFi tooling.
- Campaign becomes discoverable via Campaign Launcher API.

2) Mr.Market discovers and joins campaigns (Mr.Market -> HuFi)
- Mr.Market fetches running campaigns.
- Mr.Market joins campaigns using HuFi Recording Oracle endpoints.

3) Execution node selection and verification (Mr.Market -> EasyEnclave)
- Mr.Market selects an execution service registered in EasyEnclave.
- Mr.Market verifies EasyEnclave control plane attestation.
- Mr.Market confirms the execution node MRTD is allowed.

4) Run market making (Execution node)
- The execution node runs the strategy against the target exchange.
- The node produces an execution log/metrics snapshot.

5) Record and validate results (Execution -> HuFi Recording Oracle)
- Results are submitted (directly or via Mr.Market) to the Recording Oracle.
- Recording Oracle validates exchange data and campaign participation.

6) Payout (HuFi Reputation Oracle)
- Reputation Oracle calculates final allocations.
- On-chain payouts are executed.

## 5. Integration points (what to build / connect)

### 5.1 Mr.Market <-> HuFi
Mr.Market should integrate using HuFi public APIs:
- Campaign discovery (Campaign Launcher Server)
- Join/enroll flows (Recording Oracle)
- Optional: result submission endpoints (if needed for your scoring model)

In this repo, there is already a CampaignService that:
- fetches campaigns
- checks joined status
- posts join requests with read-only exchange credentials

### 5.2 Mr.Market <-> EasyEnclave
Mr.Market should use EasyEnclave for:
- discovering available execution services
- verifying control-plane attestation
- pinning expected MRTD per execution build/version
- routing requests to the selected attested service

Recommended policy:
- Maintain an allowlist of trusted MRTDs for “mm-executor” services.
- Do not send exchange secrets to a service unless:
  - control plane verification passes, and
  - the service’s attestation verifies, and
  - MRTD is allowlisted.

### 5.3 Execution service interface (what the TEE node should expose)
Keep this simple and versioned. A minimal HTTP API is enough:
- `POST /v1/jobs/start` (campaign_id, exchange, pair, parameters)
- `POST /v1/jobs/stop` (job_id)
- `GET /v1/jobs/{job_id}/status`
- `GET /v1/jobs/{job_id}/report` (metrics + signed digest)

The report should include:
- a deterministic digest of inputs/outputs
- timestamps
- the measurement identity (MRTD) or a linkable attestation reference

## 6. What is not solved yet (known gaps)

- A concrete, attack-resilient scoring model (anti-wash, anti-sybil, depth quality).
- Exactly what must live inside the TEE vs outside.
- Key lifecycle: how read-only keys are provisioned, rotated, and revoked per executor.
- How to bind HuFi rewards to attested execution results (data model + proofs).

## 7. Practical MVP recommendation

To get to a working MVP quickly:
- Use HuFi for campaigns and payout (already strong).
- Use Mr.Market to run the actual market making loop end-to-end.
- Use EasyEnclave to attest and discover an “mm-executor” service.
- Start with Rewards-only (no PnL sharing) until scoring + abuse resistance is proven.
