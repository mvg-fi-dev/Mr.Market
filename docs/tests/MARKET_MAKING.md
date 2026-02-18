# Market Making End-to-End Test Guide

This document covers backend end-to-end testing for market making:

- Mixin transfer from user
- snapshot handling and order creation
- withdrawal path toward exchange
- dispatch into tick-driven market making engine
- user profit and balance tracking validation

## Important Reality Check

The post-`payment_complete` lifecycle is config-gated:

- `strategy.queue_withdraw_on_payment_complete` controls whether `withdraw_to_exchange` is queued after `payment_complete`.
- `strategy.withdraw_to_exchange_enabled` controls whether `withdraw_to_exchange` actually submits withdrawals, or refunds/fails safely.
- Exchange deposit monitoring is currently implemented only for MEXC (`monitor_exchange_deposit`).

So depending on config, the runtime may stop at `payment_complete`, refund/fail at withdrawal stage, or proceed through withdrawal + deposit confirmation into `start_mm`.

## Components Under Test

- Snapshot polling/queueing: `server/src/modules/mixin/snapshots/snapshots.processor.ts`
- Snapshot decode/routing: `server/src/modules/mixin/snapshots/snapshots.service.ts`
- MM order processor and queue chain: `server/src/modules/market-making/user-orders/market-making.processor.ts`
- Tick runtime: `server/src/modules/market-making/tick/clock-tick-coordinator.service.ts`
- Strategy orchestration: `server/src/modules/market-making/strategy/strategy.service.ts`
- Intent worker: `server/src/modules/market-making/strategy/strategy-intent-worker.service.ts`
- Intent execution: `server/src/modules/market-making/strategy/strategy-intent-execution.service.ts`
- Balance ledger: `server/src/modules/market-making/ledger/balance-ledger.service.ts`
- Performance API/service: `server/src/modules/market-making/performance/performance.service.ts`
- HuFi score estimator: `server/src/modules/campaign/hufi-score-estimator.service.ts`
- Reward pipeline: `server/src/modules/market-making/rewards/reward-pipeline.service.ts`

## Queue Jobs In Scope

Queue `snapshots`:

- `process_snapshot`

Queue `market-making`:

- `process_market_making_snapshots`
- `check_payment_complete`
- `withdraw_to_exchange`
- `monitor_mixin_withdrawal`
- `monitor_exchange_deposit`
- `join_campaign` (local participation only; optional)
- `start_mm`
- `stop_mm`
- `exit_withdrawal`
- `monitor_exit_mixin_deposit`

## End-to-End Flow to Validate

1. User submits transfer with valid market making create memo.
2. Snapshot poller detects and enqueues `process_snapshot`.
3. Snapshot service decodes memo, validates intent/pair/expiry, then enqueues `process_market_making_snapshots`.
4. MM processor credits ledger (`creditDeposit`) and updates payment state.
5. `check_payment_complete` retries until base/quote/fee completeness is met.
6. Order becomes `payment_complete` and persists in market making order table.
7. Withdrawal stage:
   - default: refund/fail when withdrawals are disabled
   - full lifecycle: withdraw -> monitor Mixin confirmations -> monitor exchange deposits -> start MM
8. Strategy is registered and triggered by tick coordinator.
9. Intents are stored, dispatched by worker, and executed on exchange adapter.
10. Ledger/performance/reward/score data confirms user profit and balances.

## Test Suites

## Suite A: Current Behavior (default code path)

### A1. Valid snapshot intake and intent guard

Assert:

- invalid memo/version/intent mismatch refunds snapshot
- valid memo enqueues `process_market_making_snapshots`
- intent state transitions to active progress state

### A2. Ledger credit and payment state aggregation

Assert:

- `BalanceLedgerService.creditDeposit` called with idempotency key `snapshot-credit:{snapshotId}`
- base/quote/fee legs update correctly in payment state
- unknown asset snapshot is refunded

### A3. Payment completion and order creation

Assert:

- complete payment updates intent to `completed`
- payment state becomes `payment_complete`
- `MarketMakingOrder` is created/updated with expected state

### A4. Withdrawal validation safety

Assert:

- no real withdrawal call occurs
- refund path executes
- order transitions to `failed`

## Suite B: Full Lifecycle (enabled/simulated branch)

### B1. Withdraw and monitor confirmation

Assert:

- order state moves to `withdrawing`
- base and quote confirmation checks require `confirmations >= 1` and `transaction_hash`
- once both are confirmed, order transitions to `withdrawal_confirmed` and `deposit_confirming`

### B2. Monitor exchange deposits and start MM

Assert:

- `monitor_exchange_deposit` runs after withdrawal confirmation
- once both base and quote deposits are confirmed, order becomes `deposit_confirmed`
- `start_mm` enqueued and executed
- order becomes `running`

(Optionally) local participation:

- `join_campaign` may create a local campaign participation record, but HuFi join is handled by cron.

### B5. Exit withdrawal (exchange -> bot Mixin -> user)

Assert:

- `exit_withdrawal` stops strategy and submits exchange withdrawals to bot Mixin deposit addresses.
- `monitor_exit_mixin_deposit` waits for confirmed Mixin snapshots (prefers tx hash match; falls back to amount tolerance).
- once both base and quote deposits are confirmed, processor transfers funds back to the user via Mixin safe transfer.
- order state transitions: `exit_requested -> exit_withdrawing -> exit_refunding -> exit_complete`.

### B3. Tick -> intents -> exchange execution

Assert:

- tick triggers `StrategyService.onTick`
- intents persisted in `strategy_order_intent`
- worker concurrency rules enforced
- execution service places/cancels orders and updates tracker entries

### B4. Profit and balance tracking

Assert:

- ledger entries recorded with expected types/signs
- `balance_read_model` `available/locked/total` remain consistent
- performance endpoint returns rows for user/strategy
- HuFi score snapshots generated from closed fills
- reward allocations credited idempotently

## Required Fixtures

- user and valid `market_making_order_intent`
- enabled market-making pair config
- fee config for `deposit_to_exchange`
- snapshots for base, quote, and required fee assets
- exchange API key + network mapping (for Suite B)

Memo fixtures must include:

- valid checksum
- current version
- matching `orderId` and `marketMakingPairId`

## Pass Criteria

- state transitions are valid and complete
- no duplicate ledger entries for same idempotency key
- queue dedupe works for snapshot/payment-check jobs
- exchange execution behavior follows config flags
- user balances and profit evidence are queryable and consistent

## Last Updated

- Date: 2026-02-12
- Status: Active
