/**
 * Records per-order exchange-side fund allocations for shared bot exchange accounts.
 *
 * Purpose:
 * - In a shared exchange account, NEVER withdraw the whole account free balance on exit.
 * - Exit-withdrawal must withdraw only this order's allocated amount (base+quote).
 *
 * This table tracks what amount is considered "owned" by a specific order.
 */
import { Column, Entity, PrimaryColumn } from 'typeorm';

export type MMExchangeAllocationState =
  | 'created'
  | 'exchange_deposit_confirmed'
  | 'exit_withdrawing'
  | 'exit_complete';

@Entity('mm_exchange_allocations')
export class MMExchangeAllocation {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  userId: string;

  @Column()
  exchange: string;

  @Column()
  baseAssetId: string;

  @Column()
  baseSymbol: string;

  @Column({ default: '0' })
  baseAllocatedAmount: string;

  @Column()
  quoteAssetId: string;

  @Column()
  quoteSymbol: string;

  @Column({ default: '0' })
  quoteAllocatedAmount: string;

  @Column({ default: 'created' })
  state: MMExchangeAllocationState;

  // Exit withdrawal durability (prevents double-withdraw on retries and allows re-enqueue of monitor)
  @Column({ nullable: true })
  exitWithdrawalStartedAt?: string;

  @Column({ nullable: true })
  exitExpectedBaseTxHash?: string;

  @Column({ nullable: true })
  exitExpectedQuoteTxHash?: string;

  @Column()
  createdAt: string;

  @Column()
  updatedAt: string;
}
