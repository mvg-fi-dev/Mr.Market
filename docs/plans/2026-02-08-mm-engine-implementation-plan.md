# Market Making Engine Implementation Plan

## Executive Summary

This plan outlines the implementation of a robust market-making execution system based on the Hummingbot reference architecture, adapted to the existing NestJS/CCXT codebase.

**Key Insight:** The system already has basic market-making logic. This plan focuses on enhancing it with:
1. A clock-driven tick system for determinism
2. Proper state tracking (OrderBook, UserStream, ClientOrder trackers)
3. Connector normalization layer
4. Separation of controller (decision) from executor (execution)

---

## Phase 1: Foundation - Clock & Tick System

### 1.1 Clock Service (New)

**File:** `src/modules/execution/clock/clock.service.ts`

Create a centralized clock that drives periodic strategy execution:

```typescript
interface TimeIterator {
  c_tick(timestamp: number): Promise<void>;
}

class ClockService {
  private iterators: Set<TimeIterator>;
  private tickInterval: number = 1000; // 1 second default

  register(iterator: TimeIterator): void;
  start(): void;
  stop(): void;
}
```

**Benefits:**
- CPU determinism during market bursts
- State consistency (strategy sees settled snapshots)
- Simpler reasoning about race conditions

### 1.2 Execution Module Structure

```
src/modules/execution/
├── clock/
│   ├── clock.service.ts
│   ├── clock.module.ts
│   └── types.ts
├── trackers/
│   ├── order-book-tracker.service.ts
│   ├── user-stream-tracker.service.ts
│   └── client-order-tracker.service.ts
├── connectors/
│   ├── base.connector.ts
│   ├── binance.connector.ts
│   ├── okx.connector.ts
│   └── ...
├── controllers/
│   ├── market-making.controller.ts
│   └── types.ts
├── executors/
│   ├── order-executor.service.ts
│   └── types.ts
└── execution.module.ts
```

---

## Phase 2: Connector Layer (Exchange Normalization)

### 2.1 Base Connector Interface

**File:** `src/modules/execution/connectors/base.connector.ts`

```typescript
interface ExchangeConnector {
  // Market Data
  get_order_book(symbol: string): Promise<OrderBook>;
  subscribe_order_book(symbol: string, callback: (book: OrderBook) => void): void;
  unsubscribe_order_book(symbol: string): void;

  // Trading
  limit_buy(symbol: string, amount: number, price: number): Promise<Order>;
  limit_sell(symbol: string, amount: number, price: number): Promise<Order>;
  market_buy(symbol: string, amount: number): Promise<Order>;
  market_sell(symbol: string, amount: number): Promise<Order>;
  cancel(symbol: string, order_id: string): Promise<void>;
  cancel_all(symbol: string): Promise<void>;

  // Private Data
  get_balances(): Promise<Balance[]>;
  subscribe_orders(callback: (order: Order) => void): void;
  subscribe_trades(callback: (trade: Trade) => void): void;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  is_connected(): boolean;
}
```

### 2.2 Exchange-Specific Connectors

Create adapters for each exchange:
- `BinanceConnector` - Extends base, implements Binance-specific WS/REST
- `OKXConnector` - OKX-specific implementations
- `GateConnector` - Gate.io specifics
- etc.

**Key Responsibilities:**
- Auth/signing
- Exchange-specific parameter formats
- WS message schemas
- Rate limit policies
- Reconnection logic

### 2.3 Connector Factory

**File:** `src/modules/execution/connectors/connector.factory.ts`

```typescript
class ConnectorFactory {
  create(exchangeId: string, apiKey: string, secret: string): ExchangeConnector;
}
```

---

## Phase 3: State Trackers

### 3.1 OrderBook Tracker

**File:** `src/modules/execution/trackers/order-book-tracker.service.ts`

```typescript
class OrderBookTracker implements TimeIterator {
  private books: Map<string, LocalOrderBook>;

  // Snapshot + Diff handling
  async update_snapshot(symbol: string, snapshot: OrderBook): Promise<void>;
  async update_diff(symbol: string, diff: OrderBookDiff): Promise<void>;

  // Gap detection
  private validate_sequence(expected: number, actual: number): boolean;

  // Tick callback
  async c_tick(timestamp: number): Promise<void>;
}
```

**LocalOrderBook Data Structure:**
- Efficient O(log N) inserts/deletes
- Sequence number tracking
- Gap detection → auto-resync

### 3.2 UserStream Tracker

**File:** `src/modules/execution/trackers/user-stream-tracker.service.ts`

Tracks private events via WebSocket:
- Fills
- Order status updates
- Balance updates

```typescript
class UserStreamTracker implements TimeIterator {
  private fills: Map<string, Fill>;
  private orderStatus: Map<string, OrderStatus>;
  private balances: Map<string, Balance>;

  // Event handlers
  on_fill(fill: Fill): void;
  on_order_update(order: Order): void;
  on_balance_update(balance: Balance): void;

  async c_tick(timestamp: number): Promise<void>;
}
```

### 3.3 ClientOrder Tracker (Shadow Accounting)

**File:** `src/modules/execution/trackers/client-order-tracker.service.ts`

**Critical for safety** - prevents "did cancel succeed?" failures

```typescript
enum ClientOrderStatus {
  PENDING_CREATE,
  OPEN,
  PENDING_CANCEL,
  DONE
}

class ClientOrderTracker {
  private orders: Map<string, ClientOrder>; // client_id -> order

  // Generate client-side order ID
  generate_client_id(): string;

  // Lifecycle tracking
  track_create(order: Order): void;
  track_cancel(client_id: string): void;
  update_status(client_id: string, status: ClientOrderStatus): void;

  // Reconciliation
  async reconcile(): Promise<void>;

  // Mappings
  client_id_to_exchange_id(client_id: string): string | null;
  exchange_id_to_client_id(exchange_id: string): string | null;
}
```

**Reconciliation Protocol:**
1. If PENDING_CREATE times out → query REST for order status
2. If PENDING_CANCEL times out → query REST, cancel if still open
3. Periodic full sync via REST

---

## Phase 4: Controller Layer (Decision)

### 4.1 Market Making Controller

**File:** `src/modules/execution/controllers/market-making.controller.ts`

```typescript
interface MarketMakingConfig {
  symbol: string;
  base_spread: number;      // e.g., 0.001 = 0.1%
  ask_spread: number;
  bid_spread: number;
  order_amount: number;
  order_levels: number;
  level_spacing: number;
  refresh_interval: number;  // seconds
  inventory_skew: boolean;
  max_inventory: number;
}

class MarketMakingController implements TimeIterator {
  private config: MarketMakingConfig;
  private executor: OrderExecutor;

  async c_tick(timestamp: number): Promise<void> {
    // 1. Get current state
    const orderBook = this.orderBookTracker.get(this.config.symbol);
    const inventory = await this.get_inventory();

    // 2. Calculate target quotes
    const quotes = this.calculate_quotes(orderBook, inventory);

    // 3. Send to executor (don't execute directly)
    await this.executor.maintain_quotes(quotes);
  }

  private calculate_quotes(book: OrderBook, inventory: Inventory): Quote[] {
    const mid = (book.best_bid + book.best_ask) / 2;

    // Apply inventory skew if enabled
    const skew_factor = this.calculate_skew(inventory);

    return {
      bid: mid * (1 - this.config.bid_spread * skew_factor.bid),
      ask: mid * (1 + this.config.ask_spread * skew_factor.ask),
      amount: this.config.order_amount
    };
  }

  private calculate_skew(inventory: Inventory): SkewFactor {
    if (!this.config.inventory_skew) return { bid: 1, ask: 1 };

    // If too much base asset, sell more aggressively
    const ratio = inventory.base / this.config.max_inventory;
    return {
      bid: 1 - ratio * 0.5,  // Reduce buying
      ask: 1 + ratio * 0.5   // Increase selling
    };
  }
}
```

---

## Phase 5: Executor Layer (Execution)

### 5.1 Order Executor

**File:** `src/modules/execution/executors/order-executor.service.ts`

```typescript
class OrderExecutor {
  private connector: ExchangeConnector;
  private clientTracker: ClientOrderTracker;

  // Main entry point from controller
  async maintain_quotes(target_quotes: Quote[]): Promise<void> {
    const current_orders = await this.get_active_orders();

    // Cancel stale orders
    for (const order of current_orders) {
      if (this.is_stale(order, target_quotes)) {
        await this.cancel_order(order);
      }
    }

    // Place new orders
    for (const quote of target_quotes) {
      await this.place_quote(quote);
    }
  }

  private async place_quote(quote: Quote): Promise<void> {
    const client_id = this.clientTracker.generate_client_id();
    this.clientTracker.track_create({ client_id, ...quote });

    try {
      const result = await this.connector.limit_buy(
        quote.symbol,
        quote.amount,
        quote.price,
        { clientOrderId: client_id }
      );
      this.clientTracker.update_status(client_id, ClientOrderStatus.OPEN);
    } catch (e) {
      this.clientTracker.update_status(client_id, ClientOrderStatus.DONE);
      throw e;
    }
  }

  private async cancel_order(order: Order): Promise<void> {
    this.clientTracker.track_cancel(order.client_id);
    await this.connector.cancel(order.symbol, order.exchange_id);
  }
}
```

---

## Phase 6: Integration with Existing Code

### 6.1 Modify Existing Strategy Service

**File:** `src/modules/market-making/strategy/strategy.service.ts`

Current: Direct execution in strategy logic
New: Delegates to execution module

```typescript
// Before
class StrategyService {
  async execute_strategy(strategy: Strategy) {
    // Direct CCXT calls mixed with strategy logic
    await this.exchange.createLimitOrder(...);
  }
}

// After
class StrategyService {
  private executionModule: ExecutionModule;

  async execute_strategy(strategy: Strategy) {
    // Create controller instance
    const controller = this.executionModule.create_controller(strategy);
    this.clock.register(controller);
  }
}
```

### 6.2 User Order Integration

**File:** `src/modules/market-making/user-orders/user-orders.service.ts`

When user creates MM order:
1. Create `MarketMakingController` with user's config
2. Register with Clock
3. Executor reports fills back to user order tracking

---

## Phase 7: Risk Management & Safety

### 7.1 Rate Limiting

**File:** `src/modules/execution/common/rate-limiter.service.ts`

```typescript
class RateLimiter {
  // Token bucket per exchange
  private buckets: Map<string, TokenBucket>;

  async throttle(exchange: string, endpoint: string): Promise<void>;
}
```

### 7.2 Circuit Breaker

**File:** `src/modules/execution/common/circuit-breaker.service.ts`

```typescript
class CircuitBreaker {
  private failure_count: number;
  private last_failure_time: number;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.is_open()) {
      throw new Error('Circuit breaker is open');
    }
    try {
      return await fn();
    } catch (e) {
      this.record_failure();
      throw e;
    }
  }
}
```

---

## Implementation Order

### Sprint 1: Core Infrastructure (Week 1)
1. Create `execution` module structure
2. Implement `ClockService`
3. Implement base `ExchangeConnector` interface
4. Implement `ClientOrderTracker` (highest safety priority)

### Sprint 2: Connectors (Week 2)
1. Implement `BinanceConnector`
2. Implement `OKXConnector`
3. Test connector with WS/REST
4. Add reconnection logic

### Sprint 3: Trackers (Week 3)
1. Implement `OrderBookTracker` with snapshot+diff
2. Implement `UserStreamTracker`
3. Add gap detection and auto-resync

### Sprint 4: Controller & Executor (Week 4)
1. Implement `MarketMakingController`
2. Implement `OrderExecutor`
3. Wire controller → executor → connector

### Sprint 5: Integration (Week 5)
1. Integrate with existing `StrategyService`
2. Integrate with `UserOrdersService`
3. Migrate existing strategies to new system

### Sprint 6: Testing & Polish (Week 6)
1. Unit tests for trackers
2. Integration tests for full flow
3. Load testing
4. Documentation

---

## Key Design Decisions

### 1. Hybrid Time-Discrete (Tick-Based)
**Decision:** Use 1-second tick interval
**Rationale:** Balances responsiveness with CPU usage

### 2. Separate Controller from Executor
**Decision:** Controller computes targets, Executor handles messy details
**Rationale:** Clean separation of concerns, reusable executors

### 3. Client-Side Order IDs
**Decision:** Always generate client order IDs for tracking
**Rationale:** Enables shadow accounting, prevents lost orders

### 4. WebSocket First, REST Fallback
**Decision:** Primary data via WS, REST for recovery
**Rationale:** Lowest latency while maintaining reliability

### 5. Local Order Books
**Decision:** Maintain local copies with sequence validation
**Rationale:** Fast access, detect gaps early

---

## Migration Strategy

### Phase 1: Parallel Run
- New execution module runs alongside existing system
- Compare outputs, validate correctness

### Phase 2: Gradual Migration
- Migrate one exchange at a time
- Migrate one strategy type at a time

### Phase 3: Deprecation
- Remove old execution logic
- Clean up unused code

---

## Open Questions

1. **Tick Interval:** Is 1 second appropriate, or do we need sub-second ticks?
2. **Multi-Exchange MM:** Should we support cross-exchange market making from day 1?
3. **Backtesting:** Do we need to build backtesting infrastructure before live trading?
4. **Monitoring:** What metrics and alerts are needed for production?
