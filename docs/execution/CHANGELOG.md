# Execution Flow Changelog

## 2026-02-19

- Emit durable outbox events for trade execute/cancel/fail (traceId-ready)
- Add /health/system-status endpoint (queues + tick loop health bundle)

## 2026-02-18

- Add market-making soft control endpoints (pause/resume/stop)
- Implement exit-withdrawal flow: exchange withdrawal back to bot Mixin, then refund back to user on Mixin (monitor via snapshots)
- Harden exit withdrawal state machine with `exit_requested` to avoid conflating queueing vs execution

## 2026-02-17

- Add architecture doc for HuFi + Mr.Market + EasyEnclave responsibilities and integration flow
- Add phased TODO doc for Protocol / Execution / Participation vision layers (updated to reflect tick/ledger foundation)
- Add config-gated withdraw-to-exchange queueing and enable live withdrawal execution when explicitly enabled
- Document exchange deposit confirmation stage (`monitor_exchange_deposit`) and clarify campaign join behavior (HuFi join via cron)

## 2026-02-12

- Add Mixin CLI skill guide and execution testing docs, and restore MARKET_MAKING_FLOW.md as backend flow reference

## 2026-02-11

- Add tick-driven market-making engine foundation (tick coordinator + intent orchestration)
- Add single-writer balance ledger and durability/idempotency foundations for restart-safe processing
- Add HuFi campaign sync + reward pipeline foundations (allocations, vault transfers, reconciliation)
- Harden stop/withdraw orchestration and config wiring across modules

## 2026-02-06

- Adjust Mixin snapshot polling interval and clarify view-only exchange mode when no API keys

## 2026-02-05

- Switch Playwright workflow to SQLite and remove Postgres service

## 2026-02-04

- Add default ceiling/floor price when creating market making orders on payment completion and show payment success dialog after polling
- Store chain metadata for market-making pairs in grow data

## 2026-02-03

- Remove interface-side market making memo generator so intent API remains the memo source of truth
- Add guards and queue alignment for market-making processing (BigNumber import, withdrawal monitor retries, VWAP safety)

## 2026-02-02

- Allow market-making fee checks to treat base/quote assets as fees and dedupe payment check jobs per order

## 2026-01-31

- Add localized learn-more FAQ pages for Hu-Fi and market making (EN+ZH) with Playwright coverage and persisted language selection

## 2026-01-29

- Add quick market-making pair add flow that searches all exchanges and handles chain selection
- Cache CCXT exchange markets for 60 minutes to speed quick add lookups
- Register cache module for exchange init service
- Replace toast implementation with svelte-sonner (Svelte 4 compatible)
- Add quick add flow for spot trading and toast feedback on refresh actions
- Prevent duplicate adds for exchanges, API keys, and spot trading pairs

## 2026-01-28

- Remove Postgres leftovers and align configs/docs with SQLite
- Restore snapshot memo handling and defer market making order creation until payment completion

## 2026-01-13

- Apply agents.md rules to confirmPaymentInfo.svelte: replace uppercase with capitalize, replace h3 with span
- Disable market-making exchange withdrawals during validation; refund instead

## 2026-01-12

- Add i18n support to ExchangeSelection and ExchangeCard components
- Refactor trading pair selection UI components to match exchange selection style and follow GEMINI.md guidelines

## 2026-01-09

- Update MARKET_MAKING_FLOW.md state transitions to match actual code
- Fix withdrawal confirmation monitoring documentation with correct Mixin snapshot check
- Add withdrawal timeout (30 minutes) to error handling
- Add comprehensive ui/DESIGN_PATTERN.md with full design system documentation

