<script lang="ts">
    import { _ } from "svelte-i18n";
    import BigNumber from "bignumber.js";
    import { formatDecimals, formatUSMoney } from "$lib/helpers/utils";
    import emptyToken from "$lib/images/empty-token.svg";

    export let baseSymbol: string | null = null;
    export let quoteSymbol: string | null = null;
    export let baseIcon: string = emptyToken;
    export let quoteIcon: string = emptyToken;
    export let baseAmount: string | number | null = null;
    export let quoteAmount: string | number | null = null;
    export let baseAmountUsd: string | number | null = null;
    export let quoteAmountUsd: string | number | null = null;
    export let baseFeeAmount: string | number | null = null;
    export let baseFeeSymbol: string | null = null;
    export let quoteFeeAmount: string | number | null = null;
    export let quoteFeeSymbol: string | null = null;
    export let baseFeeUsdPrice: string | number | null = null;
    export let quoteFeeUsdPrice: string | number | null = null;
    export let baseAssetUsdPrice: string | number | null = null;
    export let quoteAssetUsdPrice: string | number | null = null;
    export let marketMakingFeePercentage: string | null = null;
    export let isFetchingFee: boolean = false;

    const formatAmount = (amount: string | number | null) => {
        if (amount === null || amount === undefined || amount === "")
            return "0";
        const parsed = Number(amount);
        if (!Number.isFinite(parsed)) return `${amount}`;
        return parsed.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8,
        });
    };

    const formatFiat = (value: string | number | null) => {
        if (value === null || value === undefined || value === "") return null;
        const numeric = formatDecimals(value, 2);
        return formatUSMoney(numeric);
    };

    const calcUsdValue = (
        amount: string | number | null,
        usdPrice: string | number | null,
    ) => {
        if (!amount || !usdPrice) return null;
        const price = Number(usdPrice);
        if (!Number.isFinite(price)) return null;
        const value = BigNumber(amount).times(price);
        if (!value.isFinite()) return null;
        return value.toNumber();
    };

    $: baseAmountUsdFormatted = formatFiat(baseAmountUsd);
    $: quoteAmountUsdFormatted = formatFiat(quoteAmountUsd);

    $: baseMarketMakingFee =
        baseAmount && marketMakingFeePercentage
            ? BigNumber(baseAmount)
                  .multipliedBy(marketMakingFeePercentage)
                  .toString()
            : null;
    $: quoteMarketMakingFee =
        quoteAmount && marketMakingFeePercentage
            ? BigNumber(quoteAmount)
                  .multipliedBy(marketMakingFeePercentage)
                  .toString()
            : null;

    $: marketMakingFeeLabel = $_("market_making_fee_with_pct", {
        values: {
            percent: (
                parseFloat(marketMakingFeePercentage || "0") * 100
            ).toFixed(2),
        },
    });

    $: feeRows = [
        {
            label: $_("network_fee"),
            amount: baseFeeAmount,
            symbol: baseFeeSymbol,
            usdValue: calcUsdValue(baseFeeAmount, baseFeeUsdPrice),
        },
        {
            label: $_("network_fee"),
            amount: quoteFeeAmount,
            symbol: quoteFeeSymbol,
            usdValue: calcUsdValue(quoteFeeAmount, quoteFeeUsdPrice),
        },
        {
            label: marketMakingFeeLabel,
            amount: baseMarketMakingFee,
            symbol: baseSymbol,
            usdValue: calcUsdValue(baseMarketMakingFee, baseAssetUsdPrice),
        },
        {
            label: marketMakingFeeLabel,
            amount: quoteMarketMakingFee,
            symbol: quoteSymbol,
            usdValue: calcUsdValue(quoteMarketMakingFee, quoteAssetUsdPrice),
        },
    ].filter(
        (row) => row.amount && parseFloat(String(row.amount)) > 0 && row.symbol,
    );

    $: feeSummary = (() => {
        const grouped = new Map<
            string,
            { symbol: string; total: BigNumber; totalUsd: BigNumber }
        >();
        for (const row of feeRows) {
            if (!row.symbol) continue;
            const amountValue = new BigNumber(row.amount || 0);
            if (!amountValue.isFinite()) continue;
            const usdValue = row.usdValue
                ? new BigNumber(row.usdValue)
                : new BigNumber(0);
            const existing = grouped.get(row.symbol);
            if (existing) {
                existing.total = existing.total.plus(amountValue);
                existing.totalUsd = existing.totalUsd.plus(usdValue);
            } else {
                grouped.set(row.symbol, {
                    symbol: row.symbol,
                    total: amountValue,
                    totalUsd: usdValue,
                });
            }
        }
        return Array.from(grouped.values()).map((entry) => ({
            symbol: entry.symbol,
            total: entry.total.toString(),
            totalUsdFormatted: formatFiat(entry.totalUsd.toNumber()),
        }));
    })();

    let showFeeBreakdown = false;
</script>

<div class="space-y-4">
    <div class="rounded-lg border border-base-200 bg-base-100 p-4 space-y-3">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <img
                    src={baseIcon || emptyToken}
                    alt={baseSymbol ?? ""}
                    class="w-9 h-9 rounded-full object-cover"
                />
                <div class="flex flex-col">
                    <span class="text-sm font-semibold">{baseSymbol ?? ""}</span
                    >
                    <span class="text-xs text-base-content/60"
                        >{$_("amount")}</span
                    >
                </div>
            </div>
            <div class="text-right">
                <div class="text-sm font-semibold">
                    {formatAmount(baseAmount)}
                    {baseSymbol ?? ""}
                </div>
                {#if baseAmountUsdFormatted}
                    <div class="text-xs text-base-content/60">
                        {baseAmountUsdFormatted}
                    </div>
                {/if}
            </div>
        </div>

        <div class="border-t border-base-200"></div>

        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <img
                    src={quoteIcon || emptyToken}
                    alt={quoteSymbol ?? ""}
                    class="w-9 h-9 rounded-full object-cover"
                />
                <div class="flex flex-col">
                    <span class="text-sm font-semibold"
                        >{quoteSymbol ?? ""}</span
                    >
                    <span class="text-xs text-base-content/60"
                        >{$_("amount")}</span
                    >
                </div>
            </div>
            <div class="text-right">
                <div class="text-sm font-semibold">
                    {formatAmount(quoteAmount)}
                    {quoteSymbol ?? ""}
                </div>
                {#if quoteAmountUsdFormatted}
                    <div class="text-xs text-base-content/60">
                        {quoteAmountUsdFormatted}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <div class="rounded-lg border border-base-200 bg-base-100 p-4 space-y-3">
        <div class="flex items-center justify-between">
            <div class="text-sm font-semibold">{$_("fees")}</div>
            <button
                type="button"
                class="btn btn-ghost btn-xs"
                aria-label={showFeeBreakdown
                    ? $_("hide_details")
                    : $_("show_details")}
                on:click={() => (showFeeBreakdown = !showFeeBreakdown)}
            >
                <span class="text-xs font-semibold">
                    {showFeeBreakdown ? $_("hide_details") : $_("show_details")}
                </span>
            </button>
        </div>
        {#if isFetchingFee}
            <div class="flex flex-col gap-2">
                <div class="skeleton h-3 w-24 bg-base-200"></div>
                <div class="skeleton h-3 w-20 bg-base-200"></div>
            </div>
        {:else if feeRows.length === 0}
            <div class="text-sm text-base-content/60">0</div>
        {:else if !showFeeBreakdown}
            <div class="space-y-2">
                {#each feeSummary as fee}
                    <div class="flex justify-between items-start">
                        <div class="text-xs text-base-content/60">
                            {fee.symbol}
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-semibold">
                                {formatAmount(fee.total)}
                                {fee.symbol}
                            </div>
                            {#if fee.totalUsdFormatted}
                                <div class="text-xs text-base-content/60">
                                    {fee.totalUsdFormatted}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="space-y-2">
                {#each feeRows as fee}
                    <div class="flex justify-between items-start">
                        <div class="text-xs text-base-content/60">
                            {fee.label}
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-semibold">
                                {formatAmount(fee.amount)}
                                {fee.symbol}
                            </div>
                            {#if fee.usdValue !== null}
                                <div class="text-xs text-base-content/60">
                                    {formatFiat(fee.usdValue)}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
