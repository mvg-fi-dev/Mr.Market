<script lang="ts">
  import Slogan from "$lib/components/grow/marketMaking/initIntro/slogan.svelte";
  import IntroButtons from "$lib/components/grow/marketMaking/initIntro/introButtons.svelte";
  import BasicStats from "$lib/components/grow/marketMaking/baseSection/basicHuFiStats.svelte";
  import Loading from "$lib/components/common/loading.svelte";

  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { mixinConnected } from "$lib/stores/home";
  import { isFirstTimeMarketMaking } from "$lib/stores/market_making";
  import { user } from "$lib/stores/wallet";
  import { getAllMarketMakingByUser } from "$lib/helpers/mrm/strategy";

  import Bar from "$lib/components/grow/marketMaking/baseSection/bar.svelte";
  import BaseIntro from "$lib/components/grow/marketMaking/baseSection/baseIntro.svelte";
  import Card from "$lib/components/grow/marketMaking/card.svelte";
  const MARKET_MAKING_INTRO_KEY = "market-making-intro-seen";

  if (browser) {
    const hasSeenIntro =
      localStorage.getItem(MARKET_MAKING_INTRO_KEY) === "true";
    isFirstTimeMarketMaking.set(!hasSeenIntro);

    if (!hasSeenIntro) {
      localStorage.setItem(MARKET_MAKING_INTRO_KEY, "true");
    }
  }

  let marketMakingOrders: any[] = [];
  let isLoadingOrders = false;
  let ordersError: string | null = null;
  let lastLoadedUserId: string | null = null;

  $: noMarketMakingCreated = marketMakingOrders.length === 0;

  const loadOrders = async (userId: string) => {
    try {
      ordersError = null;
      isLoadingOrders = true;

      const orders = await getAllMarketMakingByUser(userId);
      marketMakingOrders = Array.isArray(orders) ? orders : [];
      lastLoadedUserId = userId;

      // If user already has orders, don't block them behind the "first time" intro.
      if (marketMakingOrders.length > 0) {
        isFirstTimeMarketMaking.set(false);
      }
    } catch (e) {
      console.error("Failed to load market making orders:", e);
      ordersError = "Failed to load orders";
      marketMakingOrders = [];
      lastLoadedUserId = null;
    } finally {
      isLoadingOrders = false;
    }
  };

  // Load on mount, and also reactively reload once wallet/user becomes available
  // (e.g. after oauth/connect, or after returning from create flow).
  onMount(async () => {
    const userId = $user?.user_id;
    if ($mixinConnected && userId) {
      await loadOrders(userId);
    }
  });

  $: {
    const userId = $user?.user_id;

    if (!$mixinConnected) {
      marketMakingOrders = [];
      lastLoadedUserId = null;
    } else if (userId && userId !== lastLoadedUserId && !isLoadingOrders) {
      // user store may be populated after mount
      loadOrders(userId);
    }
  }
</script>

<!-- If not connected, show start market making, button redirect to connect wallet -->
<!-- If connected and first time user, show start market making, button go to market-making -->
{#if $isFirstTimeMarketMaking}
  <div class="flex flex-col grow space-y-0">
    <Slogan />
    <div class="">
      <IntroButtons />
    </div>
  </div>
{:else}
  {#await $page.data.campaign_stats}
    <div class="flex flex-col items-center justify-center grow h-screen">
      <Loading />
    </div>
  {:then data}
    <div class="flex flex-col grow space-y-0 mx-4">
      <BasicStats
        rewardsPool={data.rewards_pool_usd}
        activeCampaigns={data.n_active_campaigns}
      />

      <Bar />
      {#if isLoadingOrders}
        <div class="flex flex-col items-center justify-center grow py-12">
          <Loading />
        </div>
      {:else if ordersError}
        <div class="text-sm opacity-60 py-6">
          {ordersError}
        </div>
        <BaseIntro />
      {:else if noMarketMakingCreated}
        <BaseIntro />
      {:else}
        <!-- Show created market making orders -->
        <div class="flex flex-col space-y-3 pb-6">
          {#each marketMakingOrders as mm (mm.orderId)}
            <Card data={mm} />
          {/each}
        </div>
      {/if}
    </div>
  {/await}
{/if}
