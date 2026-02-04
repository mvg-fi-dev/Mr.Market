<script context="module" lang="ts">
    import { mixinAsset } from "$lib/helpers/mixin/mixin";
    import { findChainIcon } from "$lib/helpers/utils";

    const chainIconCache = new Map<string, string>();
    const chainIconPromiseCache = new Map<string, Promise<string>>();

    const getChainIconByAssetId = async (assetId: string) => {
        if (!assetId) return "";
        const cachedIcon = chainIconCache.get(assetId);
        if (cachedIcon !== undefined) {
            return cachedIcon;
        }

        const cachedPromise = chainIconPromiseCache.get(assetId);
        if (cachedPromise) {
            return cachedPromise;
        }

        const promise = (async () => {
            try {
                const asset = await mixinAsset(assetId);
                const icon = asset?.chain_id ? findChainIcon(asset.chain_id) : "";
                chainIconCache.set(assetId, icon);
                return icon;
            } catch (error) {
                chainIconCache.set(assetId, "");
                return "";
            } finally {
                chainIconPromiseCache.delete(assetId);
            }
        })();

        chainIconPromiseCache.set(assetId, promise);
        return promise;
    };
</script>

<script lang="ts">
    import { _ } from "svelte-i18n";
    import emptyToken from "$lib/images/empty-token.svg";
    import { findCoinIconBySymbol } from "$lib/helpers/helpers";
    import PairIcon from "$lib/components/common/tradingPairIcon.svelte";
    import type { MarketMakingPair } from "$lib/types/hufi/grow";

    export let pair: MarketMakingPair | null = null;
    export let exchangeName = "";
    export let selected = false;
    export let onClick = () => {};
    export let testId: string | null = null;

    $: symbol = pair?.symbol || "";
    $: baseSymbol = pair?.base_symbol || symbol.split("/")[0] || "";
    $: quoteSymbol = pair?.quote_symbol || symbol.split("/")[1] || "";
    $: basePrice = pair?.base_price ? parseFloat(pair.base_price) : 0;

    let baseChainIcon = "";
    let quoteChainIcon = "";
    let baseAssetId = "";
    let quoteAssetId = "";

    const loadChainIcon = async (assetId: string, type: "base" | "quote") => {
        const icon = await getChainIconByAssetId(assetId);
        if (type === "base" && baseAssetId === assetId) {
            baseChainIcon = icon;
        }
        if (type === "quote" && quoteAssetId === assetId) {
            quoteChainIcon = icon;
        }
    };

    $: if (pair?.base_asset_id) {
        if (baseAssetId !== pair.base_asset_id) {
            baseAssetId = pair.base_asset_id;
            void loadChainIcon(baseAssetId, "base");
        }
    } else {
        baseAssetId = "";
        baseChainIcon = "";
    }

    $: if (pair?.quote_asset_id) {
        if (quoteAssetId !== pair.quote_asset_id) {
            quoteAssetId = pair.quote_asset_id;
            void loadChainIcon(quoteAssetId, "quote");
        }
    } else {
        quoteAssetId = "";
        quoteChainIcon = "";
    }

    // Format price
    $: displayPrice =
        basePrice > 0
            ? "$" +
              basePrice.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
              })
            : "$0.00";
</script>

<button
    class="w-full flex items-center justify-between p-4 bg-base-100 border rounded-3xl transition-all duration-200 cursor-pointer
  {selected
        ? 'border-[3px] border-base-content'
        : 'border-base-200 hover:border-base-300'}"
    data-testid={testId}
    on:click|preventDefault|stopPropagation={onClick}
>
    <div class="flex items-center gap-4">
        <div class="relative flex-shrink-0">
            <PairIcon
                clazz="w-6 h-6"
                claxx="w-2 h-2"
                chain0Icon={baseChainIcon}
                chain1Icon={quoteChainIcon}
                asset0Icon={findCoinIconBySymbol(baseSymbol) || emptyToken}
                asset1Icon={findCoinIconBySymbol(quoteSymbol) || emptyToken}
            />
        </div>

        <div class="flex flex-col items-start text-left">
            <span class="text-base font-bold text-base-content">{symbol}</span>
            <div class="flex items-center gap-1">
                <span
                    class="text-[10px] text-base-content/40 font-medium tracking-wide capitalize"
                    >{exchangeName}</span
                >
            </div>
        </div>
    </div>

    <div class="flex flex-col items-end space-y-0.5">
        <span class="text-base font-bold text-base-content">{displayPrice}</span
        >
    </div>
</button>
