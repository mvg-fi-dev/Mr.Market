import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { getRFC3339Timestamp } from 'src/common/helpers/utils';

import { DurabilityService } from '../durability/durability.service';
import { ExchangeConnectorAdapterService } from '../execution/exchange-connector-adapter.service';
import { ClockTickCoordinatorService } from '../tick/clock-tick-coordinator.service';
import { TickComponent } from '../tick/tick-component.interface';

type TrackedOrder = {
  /**
   * For market-making, clientId === orderId.
   * This is used to build reproducible lifecycle bundles by orderId.
   */
  orderId?: string;
  strategyKey: string;
  traceId?: string;
  exchange: string;
  pair: string;
  exchangeOrderId: string;
  side: 'buy' | 'sell';
  price: string;
  qty: string;
  status: 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'failed';
  updatedAt: string;
};

@Injectable()
export class ExchangeOrderTrackerService
  implements TickComponent, OnModuleInit, OnModuleDestroy
{
  private readonly orders = new Map<string, TrackedOrder>();

  constructor(
    @Optional()
    private readonly clockTickCoordinatorService?: ClockTickCoordinatorService,
    @Optional()
    private readonly exchangeConnectorAdapterService?: ExchangeConnectorAdapterService,
    @Optional()
    private readonly durabilityService?: DurabilityService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.clockTickCoordinatorService?.register(
      'exchange-order-tracker',
      this,
      3,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.clockTickCoordinatorService?.unregister('exchange-order-tracker');
  }

  async start(): Promise<void> {
    return;
  }

  async stop(): Promise<void> {
    return;
  }

  async health(): Promise<boolean> {
    return true;
  }

  upsertOrder(order: TrackedOrder): void {
    this.orders.set(order.exchangeOrderId, order);
  }

  countAll(): number {
    return this.orders.size;
  }

  countOpen(strategyKey?: string): number {
    return [...this.orders.values()].filter((order) => {
      const isOpen =
        order.status === 'open' || order.status === 'partially_filled';

      if (!isOpen) {
        return false;
      }

      if (strategyKey) {
        return order.strategyKey === strategyKey;
      }

      return true;
    }).length;
  }

  getOpenOrders(strategyKey: string): TrackedOrder[] {
    return [...this.orders.values()].filter(
      (order) =>
        order.strategyKey === strategyKey &&
        (order.status === 'open' || order.status === 'partially_filled'),
    );
  }

  getByExchangeOrderId(exchangeOrderId: string): TrackedOrder | undefined {
    return this.orders.get(exchangeOrderId);
  }

  async onTick(_: string): Promise<void> {
    const openOrders = [...this.orders.values()].filter(
      (order) => order.status === 'open' || order.status === 'partially_filled',
    );

    for (const order of openOrders) {
      const latest = await this.exchangeConnectorAdapterService?.fetchOrder(
        order.exchange,
        order.pair,
        order.exchangeOrderId,
      );

      if (!latest) {
        continue;
      }

      const normalizedStatus = this.normalizeStatus(latest.status);

      if (normalizedStatus === order.status) {
        continue;
      }

      const updated = {
        ...order,
        status: normalizedStatus,
        updatedAt: getRFC3339Timestamp(),
      };

      this.orders.set(order.exchangeOrderId, updated);

      await this.durabilityService?.appendOutboxEvent({
        topic: 'market_making.exchange_order.status_changed',
        aggregateType: 'exchange_order',
        aggregateId: order.exchangeOrderId,
        /**
         * First-class audit fields for indexing/search.
         * (We also keep them in payload for replay/bundling.)
         */
        traceId: updated.traceId,
        orderId: updated.orderId,
        payload: {
          ...updated,
          orderId: order.orderId,
          eventType: 'TRACKER_EVENT',
          prevStatus: order.status,
          newStatus: normalizedStatus,
        },
      });
    }
  }

  private normalizeStatus(status: string): TrackedOrder['status'] {
    const value = (status || '').toLowerCase();

    if (value === 'open' || value === 'new') {
      return 'open';
    }
    if (value === 'partially_filled' || value === 'partially-filled') {
      return 'partially_filled';
    }
    if (value === 'closed' || value === 'filled') {
      return 'filled';
    }
    if (value === 'canceled' || value === 'cancelled') {
      return 'cancelled';
    }

    return 'failed';
  }
}
