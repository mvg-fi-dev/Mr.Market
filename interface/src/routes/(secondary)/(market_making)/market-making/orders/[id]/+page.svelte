<script lang="ts">
    import StatsHeader from "$lib/components/market-making/order-details/StatsHeader.svelte";
    import FlowStatusCard from "$lib/components/market-making/order-details/FlowStatusCard.svelte";
    import RevenueCard from "$lib/components/market-making/order-details/RevenueCard.svelte";
    import BalanceCard from "$lib/components/market-making/order-details/BalanceCard.svelte";
    import DetailsCard from "$lib/components/market-making/order-details/DetailsCard.svelte";
    import FillHistory from "$lib/components/market-making/order-details/FillHistory.svelte";
    import BottomActions from "$lib/components/market-making/order-details/BottomActions.svelte";
    import CancelOrderDialog from "$lib/components/market-making/order-details/CancelOrderDialog.svelte";
    // ModifyOrderModal removed (no modify action in order details UI)
    import ExecutionDetailsDialog from "$lib/components/market-making/order-details/ExecutionDetailsDialog.svelte";
    import type { PageData } from "./$types";
    import { _ } from "svelte-i18n";
    import BigNumber from "bignumber.js";
    import { onDestroy, onMount } from "svelte";
    import { get } from "svelte/store";

    import { ORDER_STATE_FETCH_INTERVAL, ORDER_STATE_TIMEOUT_DURATION } from "$lib/helpers/constants";

    const getPollTimeoutMs = (state?: MarketMakingState | null) => {
        // Default (short) timeout is fine for payment/UI responsiveness, but
        // withdrawal + exchange deposit confirmation can legitimately take much longer.
        if (
            state === "withdrawing" ||
            state === "withdrawal_confirmed" ||
            state === "deposit_confirming"
        ) {
            return 60 * 60 * 1000; // 60 minutes
        }

        return ORDER_STATE_TIMEOUT_DURATION;
    };
    import {
        getUserOrderMarketMakingById,
        pauseMarketMakingOrder,
        resumeMarketMakingOrder,
        exitMarketMakingOrder,
        stopMarketMakingOrder,
    } from "$lib/helpers/mrm/strategy";
    import { user } from "$lib/stores/wallet";
    import { isMarketMakingTerminalState, type MarketMakingState } from "$lib/helpers/mrm/marketMakingState";

    export let data: PageData;

    // let showModifyModal = false; // removed with ModifyOrderModal
    let showExecutionDetails = false;
    let isCancelDialogOpen = false;

    // Mock data fallback
    const mockOrder = {
        symbol: "BTC/USDT",
        ordersPlaced: "842",
        volume: "1.2M",
        active: true,
        totalRevenue: "$1,240.50",
        pnl: "+12.24%",
        profitFromSpreads: "$842.20",
        balances: {
            base: { symbol: "BTC", amount: "1.24" },
            quote: { symbol: "USDT", amount: "45,420" },
        },
        details: {
            symbol: "BTC/USDT",
            exchange: "MEXC Global",
            orderId: "#88291...ae2",
            type: "Market Maker",
            created: "Oct 24, 14:30:05",
            totalValue: "$39,675.00",
            fees: "$12.50",
        },
        fills: [
            {
                amount: "0.24 BTC",
                time: "14:32:05",
                price: "64,240.50 USDT",
                status: "Filled",
            },
        ],
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "---";
        return new Date(dateStr).toLocaleString();
    };

    let backendOrder: any = data.order?.data || data.order;
    $: history = data.history || [];
    $: executionReport = data.executionReport;
    $: lifecycle = data.lifecycle;

    let polling = {
        enabled: true,
        startedAt: 0,
        lastUpdatedAt: 0,
        timedOut: false,
        error: null as string | null,
    };

    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const normalizeOrder = (res: any) => res?.data ?? res;

    const shouldPoll = (state?: MarketMakingState | null) => {
        if (!polling.enabled) return false;
        if (polling.timedOut) return false;
        if (isMarketMakingTerminalState(state)) return false;
        return true;
    };

    const refreshNow = async () => {
        try {
            polling.error = null;
            if (!backendOrder?.orderId) return;
            const res = await getUserOrderMarketMakingById(backendOrder.orderId);
            const next = normalizeOrder(res);
            if (next) {
                backendOrder = next;
                polling.lastUpdatedAt = Date.now();
            }
        } catch (e: any) {
            polling.error = e?.message || String(e);
        }
    };

    const resumeAutoRefresh = () => {
        polling.timedOut = false;
        polling.startedAt = Date.now();
        polling.error = null;
        if (backendOrder?.orderId) {
            schedulePoll(backendOrder.orderId);
        }
    };

    const schedulePoll = (orderId: string) => {
        const startedAt = polling.startedAt || Date.now();
        polling.startedAt = startedAt;

        const setNext = (fn: () => void, ms: number) => {
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
            }
            pollTimeoutId = setTimeout(fn, ms);
        };

        const tick = async () => {
            try {
                if (!shouldPoll(backendOrder?.state)) return;

                const timeoutMs = getPollTimeoutMs(backendOrder?.state);
                if (Date.now() - startedAt > timeoutMs) {
                    polling.timedOut = true;
                    return;
                }

                const res = await getUserOrderMarketMakingById(orderId);
                const next = normalizeOrder(res);
                if (next) {
                    backendOrder = next;
                    polling.lastUpdatedAt = Date.now();
                }
            } catch (e: any) {
                polling.error = e?.message || String(e);
            } finally {
                if (shouldPoll(backendOrder?.state)) {
                    setNext(tick, ORDER_STATE_FETCH_INTERVAL);
                }
            }
        };

        setNext(tick, ORDER_STATE_FETCH_INTERVAL);
    };

    $: ordersPlaced = history.length.toString();

    $: executedCount = history.filter((h: any) => h.status === "closed").length;
    $: canceledCount = history.filter((h: any) => h.status === "canceled").length;
    $: successRate = history.length
        ? `${((executedCount / history.length) * 100).toFixed(1)}%`
        : "0%";
    $: canceledRate = history.length
        ? `${((canceledCount / history.length) * 100).toFixed(1)}%`
        : "0%";

    $: volume = history
        .reduce((acc: BigNumber, curr: any) => {
            const amount = new BigNumber(curr.amount || 0);
            const price = new BigNumber(curr.price || 0);
            return acc.plus(amount.times(price));
        }, new BigNumber(0))
        .toFormat(2);

    // Prefer backend execution report totals (reproducible bundle) when available.
    $: reportVolume = executionReport?.totals?.volume
        ? new BigNumber(executionReport.totals.volume || 0).toFormat(2)
        : volume;

    $: fills = history.map((h: any) => ({
        amount: `${h.amount}`,
        time: new Date(h.executedAt).toLocaleTimeString(),
        price: `${h.price}`,
        status: h.status || "Filled",
        side: h.side,
    }));

    onMount(() => {
        polling.enabled = true;
        polling.startedAt = Date.now();
        polling.lastUpdatedAt = Date.now();
        polling.timedOut = false;
        polling.error = null;

        if (backendOrder?.orderId) {
            schedulePoll(backendOrder.orderId);
        }
    });

    onDestroy(() => {
        polling.enabled = false;
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId);
        }
    });

    $: order = backendOrder
        ? {
              symbol: backendOrder.pair || "---",
              ordersPlaced: ordersPlaced,
              volume: volume,
              active: backendOrder.state === "running",
              totalRevenue: "---", // TODO: Calculate revenue
              pnl: "---", // TODO: Calculate PnL
              profitFromSpreads: "---",
              balances: {
                  base: {
                      symbol: backendOrder.pair?.split("/")[0] || "---",
                      amount: backendOrder.balanceA || "0",
                  },
                  quote: {
                      symbol: backendOrder.pair?.split("/")[1] || "---",
                      amount: backendOrder.balanceB || "0",
                  },
              },
              details: {
                  symbol: backendOrder.pair,
                  exchange: backendOrder.exchangeName,
                  orderId: backendOrder.orderId,
                  type: $_("market_making"),
                  created: formatDate(backendOrder.createdAt),
                  totalValue: "---",
                  fees: "---",
              },
              fills: fills,
          }
        : mockOrder;

    async function handleCancelConfirm(event: CustomEvent) {
        const { action } = event.detail;

        const currentUser = get(user);
        const userId = currentUser?.user_id;

        if (!userId || !backendOrder?.orderId) {
            console.warn("Missing userId or orderId for cancel action");
            return;
        }

        try {
            if (action === "pause") {
                await pauseMarketMakingOrder(userId, backendOrder.orderId);
            } else if (action === "stop") {
                await stopMarketMakingOrder(userId, backendOrder.orderId);
            } else if (action === "exit") {
                await exitMarketMakingOrder(userId, backendOrder.orderId);
            } else {
                // noop
            }

            await refreshNow();
        } catch (e) {
            console.error("Failed to handle cancel action:", e);
        }
    }

    const handleResume = async () => {
        const currentUser = get(user);
        const userId = currentUser?.user_id;

        if (!userId || !backendOrder?.orderId) {
            return;
        }

        try {
            await resumeMarketMakingOrder(userId, backendOrder.orderId);
            await refreshNow();
            resumeAutoRefresh();
        } catch (e) {
            console.error("Failed to resume market making:", e);
        }
    };

    const handleStop = async () => {
        const currentUser = get(user);
        const userId = currentUser?.user_id;

        if (!userId || !backendOrder?.orderId) {
            return;
        }

        try {
            await stopMarketMakingOrder(userId, backendOrder.orderId);
            await refreshNow();
        } catch (e) {
            console.error("Failed to stop market making:", e);
        }
    };

    const handleExit = async () => {
        const currentUser = get(user);
        const userId = currentUser?.user_id;

        if (!userId || !backendOrder?.orderId) {
            return;
        }

        try {
            await exitMarketMakingOrder(userId, backendOrder.orderId);
            await refreshNow();
        } catch (e) {
            console.error("Failed to exit market making:", e);
        }
    };
</script>

<div class="min-h-screen bg-gray-50 pb-10">
    <StatsHeader
        ordersPlaced={order.ordersPlaced || "0"}
        volume={order.volume || "0"}
        isActive={order.active}
        on:click={() => (showExecutionDetails = true)}
    />

    <FlowStatusCard
        state={backendOrder?.state}
        lastUpdatedAt={polling.lastUpdatedAt}
        timedOut={polling.timedOut}
        error={polling.error}
        isAutoRefreshing={shouldPoll(backendOrder?.state)}
        onRefresh={refreshNow}
        onResumeAutoRefresh={resumeAutoRefresh}
    />

    <!-- Lifecycle evidence (auditability/replayability) -->
    {#if lifecycle?.ok}
        <div class="mx-4 mt-4">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
                <div class="text-sm font-bold text-gray-500">Lifecycle evidence</div>
                <div class="mt-3 grid grid-cols-3 gap-3">
                    <div class="text-center">
                        <div class="text-lg font-bold text-base-content">
                            {lifecycle.intents?.length || 0}
                        </div>
                        <div class="text-xs text-base-content/60">Intents</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-base-content">
                            {lifecycle.openOrders?.length || 0}
                        </div>
                        <div class="text-xs text-base-content/60">Open orders</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-base-content">
                            {lifecycle.history?.length || 0}
                        </div>
                        <div class="text-xs text-base-content/60">History</div>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <RevenueCard
        totalRevenue={order.totalRevenue || "$0.00"}
        pnl={order.pnl || "0%"}
        profitFromSpreads={order.profitFromSpreads || "$0.00"}
    />

    {#if order.balances}
        <BalanceCard
            baseSymbol={order.balances.base?.symbol || "BASE"}
            baseAmount={order.balances.base?.amount || "0"}
            quoteSymbol={order.balances.quote?.symbol || "QUOTE"}
            quoteAmount={order.balances.quote?.amount || "0"}
        />
    {/if}

    {#if order.details}
        <DetailsCard
            symbol={order.details.symbol || order.symbol}
            exchange={order.details.exchange || "Unknown"}
            orderId={order.details.orderId || "---"}
            type={order.details.type || "Market Maker"}
            created={order.details.created || ""}
            totalValue={order.details.totalValue || ""}
            fees={order.details.fees || ""}
        />
    {/if}

    <FillHistory fills={order.fills || []} />

    <BottomActions
        canPause={backendOrder?.state === "running"}
        canResume={backendOrder?.state === "paused"}
        canStop={
            backendOrder?.state === "running" ||
            backendOrder?.state === "paused" ||
            backendOrder?.state === "stopped"
        }
        canExit={!isMarketMakingTerminalState(backendOrder?.state)}
        on:pause={() => (isCancelDialogOpen = true)}
        on:stop={handleStop}
        on:exit={handleExit}
        on:resume={handleResume}
    />

    <!-- Resume handled by BottomActions -->

    <!-- ModifyOrderModal removed: order details controls are now pause/stop/exit/resume -->

    <CancelOrderDialog
        isOpen={isCancelDialogOpen}
        pair={order.symbol}
        on:close={() => (isCancelDialogOpen = false)}
        on:confirm={handleCancelConfirm}
    />

    <ExecutionDetailsDialog
        isOpen={showExecutionDetails}
        totalOrders={order.ordersPlaced}
        executedOrders={executedCount.toString()}
        successRate={successRate}
        canceledOrders={canceledCount.toString()}
        canceledRate={canceledRate}
        totalVolume={reportVolume}
        volumeCurrency={order.balances?.quote?.symbol || "---"}
        on:close={() => (showExecutionDetails = false)}
    />
</div>
