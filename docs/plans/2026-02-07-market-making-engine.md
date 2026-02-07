# Market making execution plan

There are three layers:

1. User layer
   
   User transfer money to bot, bot manage money for user in user order basis
   
   Requirements:
   
   - [ ] Mixin Snapshot handling
   
   - [ ] Mixin order tracking

2. Funds moving layer
   
   Bot must manage how to move funds between mixin to exchange
   
   Requirements:
   
   - [ ] Mixin withdrawal handler
   
   - [ ] Mixin withdrawal confimation worker (track withrawal status)
   
   - [ ] User balance management worker (track user balance)





3. Execution layer

Bot must find the most effiecent way to do market making and manage funds

Crypto trading infrastructure is messy: exchanges differ wildly, WebSockets drop, REST rate limits bite, and messages arrive late or out of order. In this world, a “good” execution engine is defined less by theoretical speed and more by **staying online, staying consistent, and reconciling state correctly**.

Hummingbot is a strong reference design because it solves the real problems: **coordination**, **connector normalization**, and **state truth**.

---

## 1) The Core Loop: Clock + Tick (Hybrid Time-Discrete)

Instead of running strategy logic on every micro-event, Hummingbot uses a **clock-driven loop**:

- A central **Clock** ticks at a fixed interval (commonly **1 second**).

- Components implement a common interface (often described as a `TimeIterator`) and receive a `c_tick()` callback each tick.

- The Clock calls ticks in a controlled order (e.g., **update data first, then run strategy**).

Why this matters:

- **CPU determinism:** market bursts don’t cause strategy recalculation storms.

- **state consistency:** strategy runs against a “settled” snapshot (all updates processed up to the tick).

- **simpler reasoning:** fewer race-condition classes than pure event-driven.

Important nuance: market data still arrives asynchronously via WebSockets; the **tick is the decision barrier**.

---

## 2) Async Network Layer: WebSockets + REST (Without Blocking the Loop)

The engine’s ingestion/execution layer is inherently async:

- **WebSockets:** low-latency market data (order book diffs, trades) + private user streams (fills, balance updates).

- **REST:** order placement/cancel and snapshot recovery; also used as a fallback.

Failure tolerance is mandatory:

- **reconnect loops** with exponential backoff

- **heartbeat / ping-pong**

- **re-subscription** after reconnect

- **degraded mode** (polling if WS is unstable)

Key engineering rule (especially in Node/NestJS too):  
**never block the event loop** with heavy computations in the hot path.

---

## 3) Connector Layer: One Interface, Many Exchanges

Hummingbot’s connector abstraction is basically an Adapter layer:

Your strategy calls generic methods like:

- `get_order_book(pair)`

- `limit_buy(pair, amount, price)`

- `limit_sell(pair, amount, price)`

- `cancel(pair, order_id)`

- `get_balances()`

Each exchange connector hides the ugly details:

- auth/signing

- exchange-specific parameter formats

- WS message schemas

- rate limit policies

- retry semantics and timeouts

This is how you scale across venues without rewriting strategies.

---

## 4) State Management: Maintaining “Truth” in a Lossy World

This is the hardest part. Hummingbot relies on trackers that maintain internal truth despite missing packets and unreliable acknowledgements.

### A) OrderBookTracker (Market State)

Most exchanges provide:

1. **Snapshot** (full book via REST)

2. **Diff stream** (incremental WS updates with sequence IDs)

If a gap is detected (e.g., update 50 then 52), the book is no longer trustworthy → **discard and resync from snapshot**.

This requires efficient data structures to support fast ordered updates (O(log N) inserts/deletes) for thousands of levels.

### B) UserStreamTracker (Private State)

Tracks:

- fills

- order status updates

- balance updates

This enables fast reaction to fills without constant REST polling.

### C) ClientOrderTracker (Shadow Accounting)

This prevents the classic failure: “I sent cancel, request timed out—did it cancel or not?”

Pattern:

- generate your own **client order id**

- track lifecycle as **PENDING_CREATE → OPEN → PENDING_CANCEL → DONE**

- map **client id ↔ exchange id**

- if uncertain, run a **reconciliation check** via REST (lost-order protocol)

This is what keeps exposure safe.

---

## 5) Market Making Logic: What the Strategy Actually Does

The common “Pure Market Making” loop is simple:

1. get mid price: `(best_bid + best_ask) / 2`

2. place bid/ask around mid:
   
   - `bid = mid * (1 - bid_spread)`
   
   - `ask = mid * (1 + ask_spread)`

3. periodically **refresh** (cancel/replace) so quotes don’t drift

### Inventory Skew (Risk Control)

Market makers can get “stuck” accumulating inventory. To counter this, skew quoting:

- too much base asset → **sell more aggressively, buy less**

- achieved by shifting prices and/or adjusting sizes

### Hanging Orders (Optional)

Leave the unfilled opposite-side order on the book after one side fills, betting on mean reversion. Must have a “drift too far” cancel rule.

### Order Optimization (“Penny Jumping”)

If a wall exists at a price level, step 1 tick ahead to gain queue priority.

---

## 6) The “V2” Pattern: Separate Decision From Execution

A strong architectural refinement is splitting:

- **Controller (decision):** computes *what should happen* (targets, quotes, risk posture)

- **Executor (execution):** manages *how it happens* (place, monitor, retry, partial fills, TP/SL lifecycle)

This avoids dumping operational complexity into strategy code. The controller says: “open/maintain quotes,” and executors handle the messy details.

---

## 7) What to Copy When Building Your Own Engine

If you’re building in NestJS/Node, the big takeaways are:

- Keep **data ingestion async**; keep **strategy decisions periodic** (or hybrid).

- Build connectors as strict interfaces; everything exchange-specific stays inside them.

- Implement three truths:
  
  - **local order book** with snapshot+diff and gap detection
  
  - **private user stream** for fills/status
  
  - **client-side order shadow ledger** with reconciliation

- Centralize **rate limiting** (token bucket / queued throttler).

- Keep the hot loop lightweight; offload heavy compute to workers/services.










