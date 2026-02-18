import { SafeSnapshot } from '@mixin.dev/mixin-node-sdk';
import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { MarketMakingOrderIntent } from 'src/common/entities/market-making/market-making-order-intent.entity';
import { MarketMakingPaymentState } from 'src/common/entities/orders/payment-state.entity';
import { MarketMakingOrder } from 'src/common/entities/orders/user-orders.entity';
import { PriceSourceType } from 'src/common/enum/pricesourcetype';
import { MarketMakingCreateMemoDetails } from 'src/common/types/memo/memo';
import { CampaignService } from 'src/modules/campaign/campaign.service';
import { GrowdataRepository } from 'src/modules/data/grow-data/grow-data.repository';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';
import { MixinClientService } from 'src/modules/mixin/client/mixin-client.service';
import { ExchangeService } from 'src/modules/mixin/exchange/exchange.service';
import { TransactionService } from 'src/modules/mixin/transaction/transaction.service';
import { WithdrawalService } from 'src/modules/mixin/withdrawal/withdrawal.service';
import { WalletService } from 'src/modules/mixin/wallet/wallet.service';

const DEPOSIT_AMOUNT_TOLERANCE = new BigNumber('0.00000001');
import { Repository } from 'typeorm';

import { getRFC3339Timestamp } from '../../../common/helpers/utils';
import { FeeService } from '../fee/fee.service';
import { BalanceLedgerService } from '../ledger/balance-ledger.service';
import { LocalCampaignService } from '../local-campaign/local-campaign.service';
import { NetworkMappingService } from '../network-mapping/network-mapping.service';
import { StrategyService } from '../strategy/strategy.service';
import { UserOrdersService } from './user-orders.service';

interface JobContext {
  orderId: string;
  traceId?: string;
}

interface ProcessSnapshotJobData extends JobContext {
  snapshotId: string;
  marketMakingPairId: string;
  memoDetails: MarketMakingCreateMemoDetails;
  snapshot: SafeSnapshot;
}

interface CheckPaymentJobData extends JobContext {
  marketMakingPairId: string;
}

interface WithdrawJobData extends JobContext {
  marketMakingPairId: string;
}

type RefundTransferCommand = {
  userId: string;
  assetId: string;
  amount: string;
  debitIdempotencyKey: string;
  refType: string;
  refId: string;
  transfer: () => Promise<unknown>;
};

type LogContext = {
  traceId?: string;
  orderId?: string;
  job?: { id?: string | number; name?: string };
  exchange?: string;
  apiKeyId?: string;
};

@Processor('market-making')
export class MarketMakingOrderProcessor {
  private readonly logger = new CustomLogger(MarketMakingOrderProcessor.name);

  private logCtx(ctx: LogContext): string {
    const parts: string[] = [];

    if (ctx.traceId) parts.push(`trace=${ctx.traceId}`);
    if (ctx.orderId) parts.push(`order=${ctx.orderId}`);
    if (ctx.job?.name) parts.push(`job=${ctx.job.name}`);
    if (ctx.job?.id != null) parts.push(`jobId=${ctx.job.id}`);
    if (ctx.exchange) parts.push(`exchange=${ctx.exchange}`);
    if (ctx.apiKeyId) parts.push(`apiKeyId=${ctx.apiKeyId}`);

    return parts.length ? `[${parts.join(' ')}]` : '';
  }
  private readonly PAYMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_PAYMENT_RETRIES = 60; // Check every 10 seconds for 10 minutes

  constructor(
    private readonly userOrdersService: UserOrdersService,
    private readonly strategyService: StrategyService,
    private readonly feeService: FeeService,
    private readonly growDataRepository: GrowdataRepository,
    private readonly transactionService: TransactionService,
    private readonly withdrawalService: WithdrawalService,
    private readonly localCampaignService: LocalCampaignService,
    private readonly hufiCampaignService: CampaignService,
    private readonly exchangeService: ExchangeService,
    private readonly networkMappingService: NetworkMappingService,
    private readonly mixinClientService: MixinClientService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    @InjectRepository(MarketMakingPaymentState)
    private readonly paymentStateRepository: Repository<MarketMakingPaymentState>,
    @InjectRepository(MarketMakingOrderIntent)
    private readonly marketMakingOrderIntentRepository: Repository<MarketMakingOrderIntent>,
    @InjectRepository(MarketMakingOrder)
    private readonly marketMakingRepository: Repository<MarketMakingOrder>,
    private readonly balanceLedgerService: BalanceLedgerService,
  ) {}

  private readonly WITHDRAWAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly DEPOSIT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly EXIT_WITHDRAWAL_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  private readonly RETRY_DELAY_MS = 30000; // 30 seconds

  private async refundUser(snapshot: SafeSnapshot, reason: string) {
    this.logger.warn(`Refunding snapshot ${snapshot.snapshot_id}: ${reason}`);
    await this.executeRefundTransfer({
      userId: snapshot.opponent_id,
      assetId: snapshot.asset_id,
      amount: new BigNumber(snapshot.amount).toFixed(),
      debitIdempotencyKey: `snapshot-refund:${snapshot.snapshot_id}`,
      refType: 'market_making_snapshot_refund',
      refId: snapshot.snapshot_id,
      transfer: async () => await this.transactionService.refund(snapshot),
    });
  }

  private async refundMarketMakingPendingOrder(
    orderId: string,
    paymentState: MarketMakingPaymentState,
    reason: string,
  ) {
    const order = await this.marketMakingRepository.findOne({
      where: { orderId },
    });

    const refundUserId = order?.userId || paymentState.userId;

    if (!refundUserId) {
      this.logger.error(`Refund failed: userId missing for order ${orderId}`);

      return;
    }

    const refundMap = new Map<string, BigNumber>();
    const addRefund = (assetId?: string | null, amount?: string | null) => {
      if (!assetId || !amount) return;
      const amountValue = new BigNumber(amount);

      if (amountValue.isLessThanOrEqualTo(0)) return;
      const existing = refundMap.get(assetId) || new BigNumber(0);

      refundMap.set(assetId, existing.plus(amountValue));
    };

    addRefund(paymentState.baseAssetId, paymentState.baseAssetAmount);
    addRefund(paymentState.quoteAssetId, paymentState.quoteAssetAmount);
    addRefund(paymentState.baseFeeAssetId, paymentState.baseFeeAssetAmount);
    addRefund(paymentState.quoteFeeAssetId, paymentState.quoteFeeAssetAmount);

    if (refundMap.size === 0) {
      this.logger.warn(`No refundable amounts for order ${orderId}`);

      return;
    }

    this.logger.warn(`Refunding order ${orderId}: ${reason}`);

    for (const [assetId, amount] of refundMap.entries()) {
      this.logger.log(
        `Refunding ${amount.toString()} of asset ${assetId} to user ${refundUserId}`,
      );
      await this.executeRefundTransfer({
        userId: refundUserId,
        assetId,
        amount: amount.toFixed(),
        debitIdempotencyKey: `mm-refund:${orderId}:${assetId}`,
        refType: 'market_making_order_refund',
        refId: orderId,
        transfer: async () =>
          await this.transactionService.transfer(
            refundUserId,
            assetId,
            amount.toString(),
            `Refund:${orderId}:${assetId}`,
          ),
      });
    }
  }

  private async executeRefundTransfer(
    command: RefundTransferCommand,
  ): Promise<void> {
    let debitApplied = true;

    try {
      const debitResult = await this.balanceLedgerService.debitWithdrawal({
        userId: command.userId,
        assetId: command.assetId,
        amount: command.amount,
        idempotencyKey: command.debitIdempotencyKey,
        refType: command.refType,
        refId: command.refId,
      });

      if (debitResult && debitResult.applied === false) {
        debitApplied = false;
      }
    } catch (error) {
      this.logger.error(
        `Refund debit failed for ${command.refType}:${command.refId}:${command.assetId}: ${error.message}`,
      );

      return;
    }

    if (!debitApplied) {
      this.logger.log(
        `Skipping transfer for duplicate refund debit key ${command.debitIdempotencyKey}`,
      );

      return;
    }

    try {
      const requests = await command.transfer();

      if (!Array.isArray(requests) || requests.length === 0) {
        throw new Error('refund transfer returned no receipt');
      }
    } catch (error) {
      this.logger.error(
        `Refund transfer failed for ${command.refType}:${command.refId}:${command.assetId}: ${error.message}`,
      );
      await this.compensateRefundDebit(command);
    }
  }

  private async compensateRefundDebit(
    command: RefundTransferCommand,
  ): Promise<void> {
    try {
      await this.balanceLedgerService.creditDeposit({
        userId: command.userId,
        assetId: command.assetId,
        amount: command.amount,
        idempotencyKey: `${command.debitIdempotencyKey}:compensation`,
        refType: `${command.refType}_compensation`,
        refId: command.refId,
      });
    } catch (error) {
      this.logger.error(
        `Refund compensation credit failed for ${command.refType}:${command.refId}:${command.assetId}: ${error.message}`,
      );
    }
  }

  /**
   * Step 1: Process incoming market making snapshot
   * - Validate memo and trading pair
   * - Calculate required fees
   * - Create/update payment state tracking all 4 possible transfers
   * - Queue payment completion check
   */
  @Process('process_market_making_snapshots')
  async handleProcessMMSnapshot(job: Job<ProcessSnapshotJobData>) {
    const { snapshotId, orderId, marketMakingPairId, snapshot } = job.data;

    this.logger.log(
      `Processing MM snapshot ${snapshotId} for order ${orderId}`,
    );

    try {
      // Step 1.1: Validate trading pair exists
      const pairConfig =
        await this.growDataRepository.findMarketMakingPairById(
          marketMakingPairId,
        );

      if (!pairConfig) {
        this.logger.error(`Market making pair ${marketMakingPairId} not found`);
        await this.refundUser(snapshot, 'Trading pair not found');

        return;
      }

      if (!pairConfig.enable) {
        this.logger.error(
          `Market making pair ${marketMakingPairId} is disabled`,
        );
        await this.refundUser(snapshot, 'Trading pair disabled');

        return;
      }

      this.logger.log(
        `Validated pair: ${pairConfig.exchange_id} ${pairConfig.symbol}`,
      );

      // Step 1.2: Calculate required fees
      const feeInfo = await this.feeService.calculateMoveFundsFee(
        pairConfig.exchange_id,
        pairConfig.symbol,
        'deposit_to_exchange',
      );

      if (!feeInfo) {
        this.logger.error('Failed to calculate fees');
        await this.refundUser(snapshot, 'Fee calculation failed');

        return;
      }

      const baseFeeAssetId = feeInfo.base_fee_id;
      const quoteFeeAssetId = feeInfo.quote_fee_id;
      const requiredBaseFee = feeInfo.base_fee_amount;
      const requiredQuoteFee = feeInfo.quote_fee_amount;
      const marketMakingFeePercentage = feeInfo.market_making_fee_percentage;

      this.logger.log(
        `Fees - Base: ${requiredBaseFee} (${baseFeeAssetId}), Quote: ${requiredQuoteFee} (${quoteFeeAssetId}), MM Fee: ${marketMakingFeePercentage}%`,
      );

      // Step 1.3: Determine which asset was received
      const receivedAssetId = snapshot.asset_id;
      const receivedAmount = snapshot.amount;
      const userId = snapshot.opponent_id;

      await this.balanceLedgerService.creditDeposit({
        userId,
        assetId: receivedAssetId,
        amount: receivedAmount,
        idempotencyKey: `snapshot-credit:${snapshotId}`,
        refType: 'market_making_snapshot',
        refId: snapshotId,
      });

      // Step 1.4: Find or create payment state
      let paymentState = await this.paymentStateRepository.findOne({
        where: { orderId },
      });

      if (!paymentState) {
        // First transfer - create payment state
        this.logger.log(`Creating payment state for order ${orderId}`);

        paymentState = this.paymentStateRepository.create({
          orderId,
          userId,
          type: 'market_making',
          symbol: pairConfig.symbol,
          baseAssetId: pairConfig.base_asset_id,
          baseAssetAmount: '0',
          baseAssetSnapshotId: null,
          quoteAssetId: pairConfig.quote_asset_id,
          quoteAssetAmount: '0',
          quoteAssetSnapshotId: null,
          baseFeeAssetId: baseFeeAssetId,
          baseFeeAssetAmount: '0',
          baseFeeAssetSnapshotId: null,
          quoteFeeAssetId: quoteFeeAssetId,
          quoteFeeAssetAmount: '0',
          quoteFeeAssetSnapshotId: null,
          requiredBaseWithdrawalFee: requiredBaseFee,
          requiredQuoteWithdrawalFee: requiredQuoteFee,
          requiredStrategyFeePercentage: marketMakingFeePercentage,
          state: 'payment_pending',
          createdAt: getRFC3339Timestamp(),
          updatedAt: getRFC3339Timestamp(),
        });
      }

      // Step 1.5: Update payment state based on received asset
      let updated = false;

      if (receivedAssetId === pairConfig.base_asset_id) {
        // Base asset received
        paymentState.baseAssetAmount = BigNumber(paymentState.baseAssetAmount)
          .plus(receivedAmount)
          .toString();
        if (!paymentState.baseAssetSnapshotId) {
          paymentState.baseAssetSnapshotId = snapshotId;
        }
        updated = true;
        this.logger.log(`Base asset received: ${receivedAmount}`);
      } else if (receivedAssetId === pairConfig.quote_asset_id) {
        // Quote asset received
        paymentState.quoteAssetAmount = BigNumber(paymentState.quoteAssetAmount)
          .plus(receivedAmount)
          .toString();
        if (!paymentState.quoteAssetSnapshotId) {
          paymentState.quoteAssetSnapshotId = snapshotId;
        }
        updated = true;
        this.logger.log(`Quote asset received: ${receivedAmount}`);
      } else if (receivedAssetId === baseFeeAssetId) {
        // Base fee asset received
        paymentState.baseFeeAssetAmount = BigNumber(
          paymentState.baseFeeAssetAmount,
        )
          .plus(receivedAmount)
          .toString();
        if (!paymentState.baseFeeAssetSnapshotId) {
          paymentState.baseFeeAssetSnapshotId = snapshotId;
        }
        updated = true;
        this.logger.log(`Base fee asset received: ${receivedAmount}`);
      } else if (receivedAssetId === quoteFeeAssetId) {
        // Quote fee asset received
        paymentState.quoteFeeAssetAmount = BigNumber(
          paymentState.quoteFeeAssetAmount,
        )
          .plus(receivedAmount)
          .toString();
        if (!paymentState.quoteFeeAssetSnapshotId) {
          paymentState.quoteFeeAssetSnapshotId = snapshotId;
        }
        updated = true;
        this.logger.log(`Quote fee asset received: ${receivedAmount}`);
      } else {
        // Unknown asset
        this.logger.error(
          `Unknown asset ${receivedAssetId} received for order ${orderId}`,
        );
        await this.refundUser(snapshot, 'Unknown asset');

        return;
      }

      if (updated) {
        paymentState.updatedAt = getRFC3339Timestamp();
        await this.paymentStateRepository.save(paymentState);
      }

      // Step 1.6: Queue payment completion check (dedupe per order)
      const checkJobId = `check_payment_${orderId}`;
      const existingCheckJob = await (job.queue as any).getJob(checkJobId);

      if (existingCheckJob) {
        this.logger.log(`Payment check already queued for order ${orderId}`);
      } else {
        await (job.queue as any).add(
          'check_payment_complete',
          {
            orderId,
            marketMakingPairId,
            traceId: `mm:${orderId}`,
          } as CheckPaymentJobData,
          {
            jobId: checkJobId,
            delay: 5000,
            attempts: this.MAX_PAYMENT_RETRIES,
            backoff: { type: 'fixed', delay: 10000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        this.logger.log(`Queued payment check for order ${orderId}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing MM snapshot ${snapshotId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Step 2: Check if payment is complete
   * - Verify all 4 assets received with sufficient amounts
   * - Calculate and verify total fees
   * - Queue withdrawal if complete
   */
  @Process('check_payment_complete')
  async handleCheckPaymentComplete(job: Job<CheckPaymentJobData>) {
    const { orderId, marketMakingPairId } = job.data;
    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts = job.opts.attempts ?? this.MAX_PAYMENT_RETRIES;
    const attemptNumber = BigNumber.min(
      new BigNumber(attemptsMade).plus(1),
      new BigNumber(maxAttempts),
    ).toNumber();

    this.logger.log(
      `Checking payment for order ${orderId} (attempt ${attemptNumber}/${maxAttempts})`,
    );

    try {
      const paymentState = await this.paymentStateRepository.findOne({
        where: { orderId },
      });

      if (!paymentState) {
        this.logger.error(`Payment state not found for order ${orderId}`);

        return;
      }

      const pairConfig =
        await this.growDataRepository.findMarketMakingPairById(
          marketMakingPairId,
        );

      if (!pairConfig) {
        this.logger.error(`Pair config not found: ${marketMakingPairId}`);

        return;
      }

      // Check if all required assets received
      const hasBase = BigNumber(paymentState.baseAssetAmount).isGreaterThan(0);
      const hasQuote = BigNumber(paymentState.quoteAssetAmount).isGreaterThan(
        0,
      );

      const baseAssetAmount = BigNumber(paymentState.baseAssetAmount);
      const quoteAssetAmount = BigNumber(paymentState.quoteAssetAmount);
      const baseFeeAssetAmount = BigNumber(paymentState.baseFeeAssetAmount);
      const quoteFeeAssetAmount = BigNumber(paymentState.quoteFeeAssetAmount);
      const requiredBaseFee = BigNumber(
        paymentState.requiredBaseWithdrawalFee || 0,
      );
      const requiredQuoteFee = BigNumber(
        paymentState.requiredQuoteWithdrawalFee || 0,
      );

      // If withdrawal fees use base/quote assets, treat those amounts as fee-paid.
      const baseFeePaidAmount =
        paymentState.baseFeeAssetId === paymentState.baseAssetId
          ? baseAssetAmount
          : paymentState.baseFeeAssetId === paymentState.quoteAssetId
            ? quoteAssetAmount
            : baseFeeAssetAmount;
      const quoteFeePaidAmount =
        paymentState.quoteFeeAssetId === paymentState.quoteAssetId
          ? quoteAssetAmount
          : paymentState.quoteFeeAssetId === paymentState.baseAssetId
            ? baseAssetAmount
            : quoteFeeAssetAmount;

      // Check fees (comparing with required amounts)
      const hasBaseFee =
        requiredBaseFee.isZero() ||
        baseFeePaidAmount.isGreaterThanOrEqualTo(requiredBaseFee);
      const hasQuoteFee =
        requiredQuoteFee.isZero() ||
        quoteFeePaidAmount.isGreaterThanOrEqualTo(requiredQuoteFee);

      // Calculate required market making fee
      const totalPaidBase = baseAssetAmount;
      const totalPaidQuote = quoteAssetAmount;
      const mmFeePercentage = BigNumber(
        paymentState.requiredStrategyFeePercentage || 0,
      );

      // Note: Market making fee is usually deducted from the paid amounts
      // Here we assume user needs to pay extra or it's included

      if (!hasBase || !hasQuote) {
        // Payment incomplete - assets
        const elapsed = Date.now() - new Date(paymentState.createdAt).getTime();

        if (elapsed > this.PAYMENT_TIMEOUT_MS) {
          this.logger.error(`Payment timeout for order ${orderId}`);
          await this.userOrdersService.updateMarketMakingOrderState(
            orderId,
            'failed',
          );
          await this.refundMarketMakingPendingOrder(
            orderId,
            paymentState,
            'payment timeout',
          );

          return;
        }

        if (attemptNumber >= maxAttempts) {
          this.logger.error(`Max payment checks reached for order ${orderId}`);
          await this.userOrdersService.updateMarketMakingOrderState(
            orderId,
            'failed',
          );
          await this.refundMarketMakingPendingOrder(
            orderId,
            paymentState,
            'max payment retries exceeded',
          );

          return;
        }

        this.logger.log(
          `Payment incomplete for ${orderId} (base: ${hasBase}, quote: ${hasQuote}), retrying...`,
        );
        throw new Error(`Payment incomplete for ${orderId}`);
      }

      // Check fees
      if (!hasBaseFee || !hasQuoteFee) {
        this.logger.warn(
          `Insufficient fees for order ${orderId} (baseFee: ${hasBaseFee}, quoteFee: ${hasQuoteFee})`,
        );
        // Could either wait or reject
        // For now, let's fail and refund
        await this.userOrdersService.updateMarketMakingOrderState(
          orderId,
          'failed',
        );
        await this.refundMarketMakingPendingOrder(
          orderId,
          paymentState,
          'insufficient fees',
        );

        return;
      }

      // All payments complete!
      this.logger.log(
        `Payment complete for order ${orderId}. Base: ${paymentState.baseAssetAmount}, Quote: ${paymentState.quoteAssetAmount}`,
      );

      await this.marketMakingOrderIntentRepository.update(
        { orderId },
        {
          state: 'completed',
          updatedAt: getRFC3339Timestamp(),
        },
      );

      paymentState.state = 'payment_complete';
      paymentState.updatedAt = getRFC3339Timestamp();
      await this.paymentStateRepository.save(paymentState);

      const existingOrder = await this.marketMakingRepository.findOne({
        where: { orderId },
      });

      if (!existingOrder) {
        const mmOrder = this.marketMakingRepository.create({
          orderId,
          userId: paymentState.userId,
          pair: pairConfig.symbol,
          exchangeName: pairConfig.exchange_id,
          state: 'payment_complete',
          createdAt: getRFC3339Timestamp(),
          // Defaults - should be updated from frontend/memo
          bidSpread: '0.001',
          askSpread: '0.001',
          orderAmount: '0',
          orderRefreshTime: '10000',
          numberOfLayers: '1',
          priceSourceType: PriceSourceType.MID_PRICE,
          amountChangePerLayer: '0',
          amountChangeType: 'fixed',
          ceilingPrice: '0',
          floorPrice: '0',
        });

        await this.marketMakingRepository.save(mmOrder);
      }

      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'payment_complete',
      );

      const queueWithdraw = this.configService.get<boolean>(
        'strategy.queue_withdraw_on_payment_complete',
      );

      if (queueWithdraw) {
        await (job.queue as any).add(
          'withdraw_to_exchange',
          {
            orderId,
            marketMakingPairId,
            traceId: job.data.traceId || `mm:${orderId}`,
          } as WithdrawJobData,
          {
            jobId: `withdraw_${orderId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: false,
          },
        );

        this.logger.log(
          `Payment complete, queued withdrawal for order ${orderId}`,
        );
      } else {
        this.logger.log(
          `Payment complete, withdrawal queueing disabled for order ${orderId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking payment for ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Step 3: Withdraw to exchange
   */
  @Process('withdraw_to_exchange')
  async handleWithdrawToExchange(job: Job<WithdrawJobData>) {
    const { orderId, marketMakingPairId, traceId } = job.data;

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job })} Withdrawing to exchange`,
    );

    try {
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'withdrawing',
      );

      const paymentState = await this.paymentStateRepository.findOne({
        where: { orderId },
      });

      const pairConfig =
        await this.growDataRepository.findMarketMakingPairById(
          marketMakingPairId,
        );

      if (!paymentState || !pairConfig) {
        throw new Error('Payment state or pair config not found');
      }

      const exchangeName = pairConfig.exchange_id;

      // Get API key for this exchange
      const apiKey =
        await this.exchangeService.findFirstAPIKeyByExchange(exchangeName);

      if (!apiKey) {
        throw new Error(`No API key found for exchange ${exchangeName}`);
      }

      this.logger.log(
        `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job, exchange: exchangeName, apiKeyId: apiKey.key_id })} Using exchange api key`,
      );

      // Get accurate network identifiers using NetworkMappingService
      this.logger.log(
        `Fetching networks for base=${pairConfig.base_symbol} (${paymentState.baseAssetId}) and quote=${pairConfig.quote_symbol} (${paymentState.quoteAssetId})`,
      );

      const [baseNetwork, quoteNetwork] = await Promise.all([
        this.networkMappingService.getNetworkForAsset(
          paymentState.baseAssetId,
          pairConfig.base_symbol,
        ),
        this.networkMappingService.getNetworkForAsset(
          paymentState.quoteAssetId,
          pairConfig.quote_symbol,
        ),
      ]);

      this.logger.log(
        `Determined networks - Base: ${baseNetwork}, Quote: ${quoteNetwork}`,
      );

      // Get deposit addresses for base and quote assets
      const baseDepositResult = await this.exchangeService.getDepositAddress({
        exchange: exchangeName,
        apiKeyId: apiKey.key_id,
        symbol: pairConfig.base_symbol,
        network: baseNetwork,
      });

      const quoteDepositResult = await this.exchangeService.getDepositAddress({
        exchange: exchangeName,
        apiKeyId: apiKey.key_id,
        symbol: pairConfig.quote_symbol,
        network: quoteNetwork,
      });

      if (!baseDepositResult || !quoteDepositResult) {
        throw new Error(
          `Failed to get deposit addresses for ${pairConfig.base_symbol} or ${pairConfig.quote_symbol}`,
        );
      }

      this.logger.log(
        `Got deposit addresses - Base: ${baseDepositResult.address}, Quote: ${quoteDepositResult.address}`,
      );

      const withdrawEnabled = this.configService.get<boolean>(
        'strategy.withdraw_to_exchange_enabled',
      );

      if (!withdrawEnabled) {
        this.logger.warn(
          `Withdrawal disabled. Refunding order ${orderId} instead of sending to exchange.`,
        );

        await this.refundMarketMakingPendingOrder(
          orderId,
          paymentState,
          'withdrawal disabled',
        );

        await this.userOrdersService.updateMarketMakingOrderState(
          orderId,
          'failed',
        );

        return;
      }

      this.logger.log(
        `Executing withdrawals for order ${orderId}: base=${paymentState.baseAssetAmount} ${pairConfig.base_symbol}, quote=${paymentState.quoteAssetAmount} ${pairConfig.quote_symbol}`,
      );

      const baseWithdrawalResult =
        await this.withdrawalService.executeWithdrawal(
          paymentState.baseAssetId,
          baseDepositResult.address,
          baseDepositResult.memo || `MM:${orderId}:base`,
          paymentState.baseAssetAmount,
        );

      const quoteWithdrawalResult =
        await this.withdrawalService.executeWithdrawal(
          paymentState.quoteAssetId,
          quoteDepositResult.address,
          quoteDepositResult.memo || `MM:${orderId}:quote`,
          paymentState.quoteAssetAmount,
        );

      const baseTxId = baseWithdrawalResult?.[0]?.request_id;
      const quoteTxId = quoteWithdrawalResult?.[0]?.request_id;

      if (!baseTxId || !quoteTxId) {
        throw new Error('Withdrawal executed but missing request_id');
      }

      this.logger.log(
        `Withdrawals submitted for order ${orderId}: base=${baseTxId}, quote=${quoteTxId}`,
      );

      await (job.queue as any).add(
        'monitor_mixin_withdrawal',
        {
          orderId,
          marketMakingPairId,
          baseWithdrawalTxId: baseTxId,
          quoteWithdrawalTxId: quoteTxId,
          traceId: traceId || `mm:${orderId}`,
        },
        {
          jobId: `monitor_withdrawal_${orderId}`,
          attempts: 60,
          backoff: { type: 'fixed', delay: this.RETRY_DELAY_MS },
          removeOnComplete: false,
        },
      );

      this.logger.log(`Queued withdrawal monitor for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Error withdrawing for order ${orderId}: ${error.message}`,
        error.stack,
      );
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'failed',
      );
      throw error;
    }
  }

  /**
   * Step 4: Join Campaign
   * Called after withdrawal is confirmed on exchange
   *
   * This handler:
   * 1. Joins the HuFi campaign (external Web3 integration) if campaign details provided
   * 2. Stores local record for tracking and future reward distribution
   */
  @Process('join_campaign')
  async handleJoinCampaign(
    job: Job<{
      orderId: string;
      campaignId?: string;
      hufiCampaign?: {
        chainId: number;
        campaignAddress: string;
      };
    }>,
  ) {
    const { orderId, campaignId, hufiCampaign } = job.data;

    this.logger.log(`Joining campaign for order ${orderId}`);

    try {
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'joining_campaign',
      );

      const order =
        await this.userOrdersService.findMarketMakingByOrderId(orderId);

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Step 1: Try to join HuFi campaign (external Web3 integration)
      let hufiJoinResult = null;

      if (hufiCampaign?.chainId && hufiCampaign?.campaignAddress) {
        try {
          this.logger.log(
            `Joining HuFi campaign: chainId=${hufiCampaign.chainId}, address=${hufiCampaign.campaignAddress}`,
          );

          // Get active campaigns to find matching one
          const campaigns = await this.hufiCampaignService.getCampaigns();
          const matchingCampaign = campaigns.find(
            (c) =>
              c.chainId === hufiCampaign.chainId &&
              c.address.toLowerCase() ===
                hufiCampaign.campaignAddress.toLowerCase(),
          );

          if (matchingCampaign) {
            // Use the @Cron auto-join logic from CampaignService
            // The cron job handles Web3 auth and joining
            this.logger.log(
              `Found matching HuFi campaign: ${matchingCampaign.address}. Will be auto-joined by cron.`,
            );
            hufiJoinResult = { scheduled: true, campaign: matchingCampaign };
          } else {
            this.logger.warn(
              `HuFi campaign not found: chainId=${hufiCampaign.chainId}, address=${hufiCampaign.campaignAddress}`,
            );
          }
        } catch (hufiError) {
          // HuFi join failure should not block the MM order flow
          this.logger.error(
            `Failed to join HuFi campaign (non-blocking): ${hufiError.message}`,
          );
        }
      }

      // Step 2: Store local campaign record for tracking and reward distribution
      const localCampaignId =
        campaignId || `mm_${order.exchangeName}_${order.pair}`;
      const participation = await this.localCampaignService.joinCampaign(
        order.userId,
        localCampaignId,
        orderId,
      );

      this.logger.log(
        `Local campaign record created for order ${orderId}: participationId=${participation.id}`,
      );

      if (hufiJoinResult) {
        this.logger.log(`HuFi campaign join scheduled for order ${orderId}`);
      }

      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'campaign_joined',
      );

      // Queue market making start
      await (job.queue as any).add(
        'start_mm',
        {
          userId: order.userId,
          orderId,
        },
        {
          jobId: `start_mm_${orderId}`,
          attempts: 3,
          removeOnComplete: false,
        },
      );

      this.logger.log(`Queued market making start for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Error joining campaign for ${orderId}: ${error.message}`,
        error.stack,
      );
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'failed',
      );
      throw error;
    }
  }

  @Process('start_mm')
  async handleStartMM(job: Job<{ userId: string; orderId: string }>) {
    const { userId, orderId } = job.data;

    this.logger.log(`Starting MM for user ${userId}, order ${orderId}`);

    const order =
      await this.userOrdersService.findMarketMakingByOrderId(orderId);

    if (!order) {
      this.logger.error(`MM Order ${orderId} not found`);

      return;
    }

    await this.userOrdersService.updateMarketMakingOrderState(
      orderId,
      'running',
    );

    const toNumber = (value?: string | number | null, fallback = 0) =>
      new BigNumber(value ?? fallback).toNumber();

    await this.strategyService.executePureMarketMakingStrategy({
      ...order,
      pair: order.pair.replaceAll('-ERC20', ''),
      clientId: orderId,
      bidSpread: toNumber(order.bidSpread),
      askSpread: toNumber(order.askSpread),
      orderAmount: toNumber(order.orderAmount),
      orderRefreshTime: toNumber(order.orderRefreshTime),
      numberOfLayers: toNumber(order.numberOfLayers),
      amountChangePerLayer: toNumber(order.amountChangePerLayer),
      ceilingPrice: toNumber(order.ceilingPrice),
      floorPrice: toNumber(order.floorPrice),
    });
  }

  @Process('stop_mm')
  async handleStopMM(job: Job<{ userId: string; orderId: string }>) {
    const { userId, orderId } = job.data;

    this.logger.log(`Stopping MM for user ${userId}, order ${orderId}`);

    await this.strategyService.stopStrategyForUser(
      userId,
      orderId,
      'pureMarketMaking',
    );
    await this.userOrdersService.updateMarketMakingOrderState(
      orderId,
      'stopped',
    );
  }

  /**
   * Exit: stop market making and withdraw funds back to user via bot Mixin.
   * MVP:
   * - stop strategy (soft)
   * - withdraw all exchange free balance of base+quote to bot deposit address
   * - refund to user after bot receives deposits (TODO: monitor + transfer)
   */
  @Process('exit_withdrawal')
  async handleExitWithdrawal(job: Job<{ userId: string; orderId: string }>) {
    const { userId, orderId } = job.data;

    this.logger.log(`Exit withdrawal for user ${userId}, order ${orderId}`);

    await this.strategyService.stopStrategyForUser(
      userId,
      orderId,
      'pureMarketMaking',
    );

    const order =
      await this.userOrdersService.findMarketMakingByOrderId(orderId);

    if (!order) {
      throw new Error(`MM Order ${orderId} not found`);
    }

    if (order.state === 'exit_complete') {
      this.logger.log(`Exit already completed for order ${orderId}, skipping`);

      return;
    }

    // State gate: only allow exit from known non-terminal states.
    // (We intentionally allow running/paused/stopped/payment_* so users can always exit.)
    const allowedStates: Array<typeof order.state> = [
      'payment_pending',
      'payment_incomplete',
      'payment_complete',
      'created',
      'running',
      'paused',
      'stopped',
      'withdrawing',
      'withdrawal_confirmed',
      'deposit_confirming',
      'deposit_confirmed',
      'joining_campaign',
      'campaign_joined',
      'exit_requested',
      'exit_withdrawing',
      'exit_refunding',
    ];

    if (!allowedStates.includes(order.state)) {
      throw new Error(
        `Exit not allowed for order ${orderId} in state ${order.state}`,
      );
    }

    const pairConfig =
      await this.growDataRepository.findMarketMakingPairByExchangeAndSymbol(
        order.exchangeName,
        order.pair,
      );

    if (!pairConfig) {
      throw new Error(
        `Market making pair config not found for ${order.exchangeName} ${order.pair}`,
      );
    }

    const exchangeName = pairConfig.exchange_id;

    const apiKey =
      await this.exchangeService.findFirstAPIKeyByExchange(exchangeName);

    if (!apiKey) {
      throw new Error(`No API key found for exchange ${exchangeName}`);
    }

    // Determine exchange networks (ccxt) for base/quote
    const [baseNetwork, quoteNetwork] = await Promise.all([
      this.networkMappingService.getNetworkForAsset(
        pairConfig.base_asset_id,
        pairConfig.base_symbol,
      ),
      this.networkMappingService.getNetworkForAsset(
        pairConfig.quote_asset_id,
        pairConfig.quote_symbol,
      ),
    ]);

    // Bot deposit address on Mixin is derived by asset_id -> chain_id
    const [baseDeposit, quoteDeposit] = await Promise.all([
      this.walletService.depositAddress(pairConfig.base_asset_id),
      this.walletService.depositAddress(pairConfig.quote_asset_id),
    ]);

    const toWithdrawalAmount = (value: any): string => {
      const amount = new BigNumber(value || 0);

      if (!amount.isFinite() || amount.isLessThanOrEqualTo(0)) {
        return '0';
      }

      return amount.toFixed();
    };

    const baseFree = await this.exchangeService.getBalanceBySymbol(
      exchangeName,
      apiKey.api_key,
      apiKey.api_secret,
      pairConfig.base_symbol,
    );
    const quoteFree = await this.exchangeService.getBalanceBySymbol(
      exchangeName,
      apiKey.api_key,
      apiKey.api_secret,
      pairConfig.quote_symbol,
    );

    const baseAmount = toWithdrawalAmount(baseFree?.[pairConfig.base_symbol]);
    const quoteAmount = toWithdrawalAmount(
      quoteFree?.[pairConfig.quote_symbol],
    );

    const baseWithdrawal = new BigNumber(baseAmount).isGreaterThan(0)
      ? await this.exchangeService.createWithdrawal({
          exchange: exchangeName,
          apiKeyId: apiKey.key_id,
          symbol: pairConfig.base_symbol,
          network: baseNetwork,
          address: baseDeposit.address,
          tag: baseDeposit.memo || '',
          amount: baseAmount,
        })
      : null;

    const quoteWithdrawal = new BigNumber(quoteAmount).isGreaterThan(0)
      ? await this.exchangeService.createWithdrawal({
          exchange: exchangeName,
          apiKeyId: apiKey.key_id,
          symbol: pairConfig.quote_symbol,
          network: quoteNetwork,
          address: quoteDeposit.address,
          tag: quoteDeposit.memo || '',
          amount: quoteAmount,
        })
      : null;

    await this.userOrdersService.updateMarketMakingOrderState(
      orderId,
      'exit_withdrawing',
    );

    await (job.queue as any).add(
      'monitor_exit_mixin_deposit',
      {
        userId,
        orderId,
        exchangeName,
        baseAssetId: pairConfig.base_asset_id,
        quoteAssetId: pairConfig.quote_asset_id,
        expectedBaseAmount: baseAmount,
        expectedQuoteAmount: quoteAmount,
        expectedBaseTxHash: this.pickTxHash(baseWithdrawal),
        expectedQuoteTxHash: this.pickTxHash(quoteWithdrawal),
        traceId: `mm:exit:${orderId}`,
        startedAt: Date.now(),
      },
      {
        jobId: `monitor_exit_mixin_deposit_${orderId}`,
        attempts: 120,
        backoff: { type: 'fixed', delay: this.RETRY_DELAY_MS },
        removeOnComplete: false,
      },
    );
  }

  /**
   * Monitor market making withdrawal confirmations
   * This handler checks both base and quote withdrawal confirmations
   * and proceeds to monitor_exchange_deposit once both are confirmed
   */
  @Process('monitor_exit_mixin_deposit')
  async handleMonitorExitMixinDeposit(
    job: Job<{
      userId: string;
      orderId: string;
      exchangeName: string;
      baseAssetId: string;
      quoteAssetId: string;
      expectedBaseAmount?: string;
      expectedQuoteAmount?: string;
      expectedBaseTxHash?: string;
      expectedQuoteTxHash?: string;
      traceId?: string;
      startedAt?: number;
    }>,
  ) {
    const {
      userId,
      orderId,
      baseAssetId,
      quoteAssetId,
      expectedBaseAmount,
      expectedQuoteAmount,
      expectedBaseTxHash,
      expectedQuoteTxHash,
      traceId,
    } = job.data;
    const startedAt = job.data.startedAt ?? Date.now();

    if (!job.data.startedAt) {
      await job.update({ ...job.data, startedAt });
    }

    const elapsed = Date.now() - startedAt;

    // State gate: do not refund if the order is not in exit-related states.
    const order =
      await this.userOrdersService.findMarketMakingByOrderId(orderId);

    if (!order) {
      throw new Error(`MM Order ${orderId} not found`);
    }

    if (order.state === 'exit_complete') {
      this.logger.log(
        `Exit already completed for order ${orderId}, skipping refund`,
      );

      return;
    }

    if (!['exit_withdrawing', 'exit_refunding'].includes(order.state)) {
      throw new Error(
        `Exit deposit monitor not allowed for order ${orderId} in state ${order.state}`,
      );
    }

    if (elapsed > this.EXIT_WITHDRAWAL_TIMEOUT_MS) {
      this.logger.error(
        `Exit withdrawal timeout for order ${orderId} after ${elapsed}ms`,
      );
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'failed',
      );

      return;
    }

    const snapshots =
      await this.mixinClientService.client.safe.fetchSafeSnapshots({
        limit: 200,
      } as any);

    const baseExpected = new BigNumber(expectedBaseAmount || 0);
    const quoteExpected = new BigNumber(expectedQuoteAmount || 0);

    const baseSnapshot = baseExpected.isGreaterThan(0)
      ? this.findMatchingMixinDeposit({
          snapshots,
          assetId: baseAssetId,
          expectedAmount: expectedBaseAmount,
          expectedTxHash: expectedBaseTxHash,
          startedAt,
        })
      : null;
    const quoteSnapshot = quoteExpected.isGreaterThan(0)
      ? this.findMatchingMixinDeposit({
          snapshots,
          assetId: quoteAssetId,
          expectedAmount: expectedQuoteAmount,
          expectedTxHash: expectedQuoteTxHash,
          startedAt,
        })
      : null;

    const baseConfirmed = baseExpected.isLessThanOrEqualTo(0) || !!baseSnapshot;
    const quoteConfirmed =
      quoteExpected.isLessThanOrEqualTo(0) || !!quoteSnapshot;

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:exit:${orderId}`, orderId, job })} Exit deposit status - Base: ${
        baseConfirmed ? 'confirmed' : 'pending'
      }, Quote: ${quoteConfirmed ? 'confirmed' : 'pending'}`,
    );

    if (!baseConfirmed || !quoteConfirmed) {
      throw new Error('Exit deposits not fully confirmed yet');
    }

    await this.userOrdersService.updateMarketMakingOrderState(
      orderId,
      'exit_refunding',
    );

    if (baseSnapshot) {
      await this.executeRefundTransfer({
        userId,
        assetId: baseAssetId,
        amount: new BigNumber(baseSnapshot.amount).toFixed(),
        debitIdempotencyKey: `mm-exit-refund:${orderId}:${baseAssetId}`,
        refType: 'market_making_exit_refund',
        refId: orderId,
        transfer: async () =>
          await this.transactionService.transfer(
            userId,
            baseAssetId,
            new BigNumber(baseSnapshot.amount).toFixed(),
            `ExitRefund:${orderId}:base`,
          ),
      });
    }

    if (quoteSnapshot) {
      await this.executeRefundTransfer({
        userId,
        assetId: quoteAssetId,
        amount: new BigNumber(quoteSnapshot.amount).toFixed(),
        debitIdempotencyKey: `mm-exit-refund:${orderId}:${quoteAssetId}`,
        refType: 'market_making_exit_refund',
        refId: orderId,
        transfer: async () =>
          await this.transactionService.transfer(
            userId,
            quoteAssetId,
            new BigNumber(quoteSnapshot.amount).toFixed(),
            `ExitRefund:${orderId}:quote`,
          ),
      });
    }

    await this.userOrdersService.updateMarketMakingOrderState(
      orderId,
      'exit_complete',
    );
  }

  private pickTxHash(withdrawal: any): string | undefined {
    if (!withdrawal || typeof withdrawal !== 'object') {
      return undefined;
    }

    return (
      withdrawal.txid ||
      withdrawal.txHash ||
      withdrawal.hash ||
      withdrawal.transactionHash ||
      undefined
    );
  }

  private findMatchingMixinDeposit(params: {
    snapshots: any[];
    assetId: string;
    expectedAmount?: string;
    expectedTxHash?: string;
    startedAt: number;
  }): any | null {
    const { snapshots, assetId, expectedAmount, expectedTxHash, startedAt } =
      params;

    const startedAtMs = startedAt;

    const isAfterStart = (createdAt?: string) => {
      if (!createdAt) {
        return false;
      }

      const ms = Date.parse(createdAt);

      if (!Number.isFinite(ms)) {
        return false;
      }

      return ms >= startedAtMs;
    };

    const expectedAmountBn = expectedAmount
      ? new BigNumber(expectedAmount)
      : null;
    const tolerance = new BigNumber('1e-8');

    for (const s of snapshots || []) {
      if (!s || s.asset_id !== assetId) {
        continue;
      }

      if (!isAfterStart(s.created_at)) {
        continue;
      }

      if (s.confirmations != null && Number(s.confirmations) < 1) {
        continue;
      }

      if (expectedTxHash && s.transaction_hash) {
        if (String(s.transaction_hash) === String(expectedTxHash)) {
          return s;
        }

        continue;
      }

      if (!expectedAmountBn || !expectedAmountBn.isFinite()) {
        continue;
      }

      const amountBn = new BigNumber(s.amount || 0);

      if (!amountBn.isFinite() || amountBn.isLessThanOrEqualTo(0)) {
        continue;
      }

      if (
        amountBn.minus(expectedAmountBn).abs().isLessThanOrEqualTo(tolerance)
      ) {
        return s;
      }
    }

    return null;
  }

  @Process('monitor_mixin_withdrawal')
  async handleMonitorMMWithdrawal(
    job: Job<{
      orderId: string;
      marketMakingPairId: string;
      baseWithdrawalTxId?: string;
      quoteWithdrawalTxId?: string;
      baseWithdrawalTxHash?: string;
      quoteWithdrawalTxHash?: string;
      startedAt?: number;
      traceId?: string;
    }>,
  ) {
    const {
      orderId,
      baseWithdrawalTxId,
      quoteWithdrawalTxId,
      baseWithdrawalTxHash,
      quoteWithdrawalTxHash,
      traceId,
    } = job.data;
    const startedAt = job.data.startedAt ?? Date.now();

    if (!job.data.startedAt) {
      await job.update({ ...job.data, startedAt });
    }
    const retryCount = job.attemptsMade || 0;

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job })} Monitoring MM withdrawals (attempt ${
        retryCount + 1
      })`,
    );

    try {
      // Check base withdrawal confirmation
      const baseStatus = baseWithdrawalTxId
        ? await this.checkWithdrawalConfirmation(baseWithdrawalTxId)
        : { confirmed: false };

      // Check quote withdrawal confirmation
      const quoteStatus = quoteWithdrawalTxId
        ? await this.checkWithdrawalConfirmation(quoteWithdrawalTxId)
        : { confirmed: false };

      this.logger.log(
        `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job })} Withdrawal status - Base: ${
          baseStatus.confirmed ? 'confirmed' : 'pending'
        }, Quote: ${quoteStatus.confirmed ? 'confirmed' : 'pending'}`,
      );

      // Check for timeout
      const elapsed = Date.now() - startedAt;

      if (elapsed > this.WITHDRAWAL_TIMEOUT_MS) {
        this.logger.error(
          `Withdrawal confirmation timeout for order ${orderId} after ${elapsed}ms`,
        );
        // Mark order as failed due to timeout
        await this.userOrdersService.updateMarketMakingOrderState(
          orderId,
          'failed',
        );

        return;
      }

      // If both confirmed, proceed to monitor exchange deposits
      if (baseStatus.confirmed && quoteStatus.confirmed) {
        this.logger.log(
          `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job })} Both withdrawals confirmed, proceeding to monitor exchange deposits`,
        );

        await this.userOrdersService.updateMarketMakingOrderState(
          orderId,
          'withdrawal_confirmed',
        );

        await this.userOrdersService.updateMarketMakingOrderState(
          orderId,
          'deposit_confirming',
        );

        await (job.queue as any).add(
          'monitor_exchange_deposit',
          {
            orderId,
            marketMakingPairId: job.data.marketMakingPairId,
            baseWithdrawalTxHash: baseStatus.txHash,
            quoteWithdrawalTxHash: quoteStatus.txHash,
            traceId: traceId || `mm:${orderId}`,
            startedAt,
          },
          {
            jobId: `monitor_exchange_deposit_${orderId}`,
            attempts: 120,
            backoff: { type: 'fixed', delay: this.RETRY_DELAY_MS },
            removeOnComplete: false,
          },
        );

        this.logger.log(`Queued monitor_exchange_deposit for order ${orderId}`);

        return;
      }

      // Not confirmed yet, retry via Bull backoff
      this.logger.log(
        `Withdrawals not fully confirmed for order ${orderId}, retrying via Bull backoff`,
      );
      throw new Error('Withdrawals not fully confirmed yet');
    } catch (error) {
      this.logger.error(
        `Error monitoring MM withdrawal for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if a withdrawal is confirmed by checking the Mixin snapshot
   */
  @Process('monitor_exchange_deposit')
  async handleMonitorExchangeDeposit(
    job: Job<{
      orderId: string;
      marketMakingPairId: string;
      baseWithdrawalTxHash?: string;
      quoteWithdrawalTxHash?: string;
      startedAt?: number;
      traceId?: string;
    }>,
  ) {
    const {
      orderId,
      marketMakingPairId,
      baseWithdrawalTxHash,
      quoteWithdrawalTxHash,
      traceId,
    } = job.data;
    const startedAt = job.data.startedAt ?? Date.now();

    if (!job.data.startedAt) {
      await job.update({ ...job.data, startedAt });
    }

    const retryCount = job.attemptsMade || 0;

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job })} Monitoring exchange deposits (attempt ${
        retryCount + 1
      })`,
    );

    const elapsed = Date.now() - startedAt;

    if (elapsed > this.DEPOSIT_TIMEOUT_MS) {
      this.logger.error(
        `Exchange deposit confirmation timeout for order ${orderId} after ${elapsed}ms`,
      );

      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'failed',
      );

      return;
    }

    const order =
      await this.userOrdersService.findMarketMakingByOrderId(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const pairConfig =
      await this.growDataRepository.findMarketMakingPairById(
        marketMakingPairId,
      );

    if (!pairConfig) {
      throw new Error(`Market making pair ${marketMakingPairId} not found`);
    }

    const paymentState = await this.paymentStateRepository.findOne({
      where: { orderId },
    });

    if (!paymentState) {
      throw new Error(`Payment state not found for order ${orderId}`);
    }

    const exchangeName = pairConfig.exchange_id;

    if (exchangeName !== 'mexc') {
      this.logger.warn(
        `Exchange deposit monitor currently only implemented for mexc. Got ${exchangeName}.`,
      );
      throw new Error('unsupported exchange for deposit monitor');
    }

    const apiKey =
      await this.exchangeService.findFirstAPIKeyByExchange(exchangeName);

    if (!apiKey) {
      throw new Error(`No API key found for exchange ${exchangeName}`);
    }

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job, exchange: exchangeName, apiKeyId: apiKey.key_id })} Using exchange api key`,
    );

    const [baseNetwork, quoteNetwork] = await Promise.all([
      this.networkMappingService.getNetworkForAsset(
        paymentState.baseAssetId,
        pairConfig.base_symbol,
      ),
      this.networkMappingService.getNetworkForAsset(
        paymentState.quoteAssetId,
        pairConfig.quote_symbol,
      ),
    ]);

    const since = startedAt;

    const deposits = await this.exchangeService.getDeposits({
      exchange: exchangeName,
      apiKeyId: apiKey.key_id,
      since,
      limit: 200,
    });

    const matchDeposit = (
      symbol: string,
      network: string,
      expectedAmount: string,
      expectedTxHash?: string,
    ) => {
      const expectedBn = new BigNumber(expectedAmount || '0');

      return deposits.find((d: any) => {
        const dSymbol = (d.currency || d.code || '').toString();
        const dNetwork = (d.network || '').toString();

        if (!dSymbol || !dNetwork) {
          return false;
        }

        if (dSymbol.toUpperCase() !== symbol.toUpperCase()) {
          return false;
        }

        if (dNetwork !== network) {
          return false;
        }

        // If we have an expected tx hash from Mixin, prefer strict match.
        if (expectedTxHash) {
          const dTxid = (
            d.txid ||
            d.txId ||
            d.txHash ||
            d.hash ||
            ''
          ).toString();

          if (!dTxid) {
            return false;
          }

          return dTxid.toLowerCase() === expectedTxHash.toLowerCase();
        }

        const amountBn = new BigNumber(
          d.amount ?? d.quantity ?? d.value ?? '0',
        );

        if (!amountBn.isFinite() || amountBn.isLessThanOrEqualTo(0)) {
          return false;
        }

        const delta = amountBn.minus(expectedBn).abs();

        return delta.isLessThanOrEqualTo(DEPOSIT_AMOUNT_TOLERANCE);
      });
    };

    const baseDeposit = matchDeposit(
      pairConfig.base_symbol,
      baseNetwork,
      paymentState.baseAssetAmount,
      baseWithdrawalTxHash,
    );

    const quoteDeposit = matchDeposit(
      pairConfig.quote_symbol,
      quoteNetwork,
      paymentState.quoteAssetAmount,
      quoteWithdrawalTxHash,
    );

    this.logger.log(
      `${this.logCtx({ traceId: traceId || `mm:${orderId}`, orderId, job, exchange: exchangeName, apiKeyId: apiKey.key_id })} Exchange deposit status - Base: ${
        baseDeposit ? 'confirmed' : 'pending'
      }, Quote: ${quoteDeposit ? 'confirmed' : 'pending'}`,
    );

    if (baseDeposit && quoteDeposit) {
      await this.userOrdersService.updateMarketMakingOrderState(
        orderId,
        'deposit_confirmed',
      );

      await (job.queue as any).add(
        'start_mm',
        {
          userId: order.userId,
          orderId,
        },
        {
          jobId: `start_mm_${orderId}`,
          attempts: 3,
          removeOnComplete: false,
        },
      );

      this.logger.log(
        `Exchange deposits confirmed for order ${orderId}, queued start_mm`,
      );

      return;
    }

    throw new Error('Exchange deposits not fully confirmed yet');
  }

  /**
   * Check if a withdrawal is confirmed by checking the Mixin snapshot
   */
  private async checkWithdrawalConfirmation(
    txId: string,
  ): Promise<{ confirmed: boolean; txHash?: string }> {
    try {
      const snapshot =
        await this.mixinClientService.client.safe.fetchSafeSnapshot(txId);

      if (!snapshot) {
        this.logger.warn(`Snapshot ${txId} not found`);

        return { confirmed: false };
      }

      // Consider confirmed if we have at least 1 confirmation and a transaction hash
      const confirmed =
        snapshot.confirmations >= 1 && !!snapshot.transaction_hash;

      if (confirmed) {
        this.logger.log(
          `Withdrawal ${txId} confirmed (confirmations: ${snapshot.confirmations}, hash: ${snapshot.transaction_hash})`,
        );
      }

      return {
        confirmed,
        txHash: snapshot.transaction_hash || undefined,
      };
    } catch (error) {
      this.logger.error(`Error checking withdrawal ${txId}: ${error.message}`);

      return { confirmed: false };
    }
  }
}
