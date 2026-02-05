<script lang="ts">
  import { goto } from "$app/navigation";
  import { _ } from "svelte-i18n";
  import type { ApiCampaign } from "$lib/helpers/mrm/campaignFormatter";

  export let campaign: ApiCampaign;

  let showDialog = false;
</script>

<div
  class="fixed bottom-0 left-0 right-0 p-5 bg-base-100 border-t border-gray-100 flex gap-4 pb-8 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
>
  <button
    class="flex-1 btn bg-base-100 hover:bg-base-200 text-base-content border border-gray-200 rounded-full h-12 min-h-12 text-sm font-bold normal-case shadow-sm"
    on:click={() => goto("/market-making/hufi/join")}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
    {$_("hufi_campaign_join_direct")}
  </button>
  <button
    class="flex-[1.5] btn bg-base-content hover:bg-base-content/90 text-base-100 border-none rounded-full h-12 min-h-12 text-sm font-bold normal-case shadow-lg"
    data-testid="hufi-create-button"
    on:click={() => (showDialog = true)}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      class="w-4 h-4"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
    {$_("hufi_campaign_create_mmaking")}
  </button>
</div>

<!-- Create Market-Making Dialog -->
<dialog
  id="hufi_create_dialog"
  class="modal modal-bottom sm:modal-middle"
  class:modal-open={showDialog}
>
  <div class="modal-box space-y-3 pt-0" data-testid="hufi-create-dialog">
    <div class="sticky top-0 bg-opacity-100 bg-base-100 z-10 pt-4">
      <div class="flex justify-between items-center">
        <span class="font-semibold">{$_("hufi_campaign_create_mmaking")}</span>
        <button on:click={() => (showDialog = false)} aria-label="Close dialog">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="space-y-4">
      <div class="bg-gray-50 rounded-lg p-4 space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-600">{$_("exchange")}</span>
          <span class="text-sm font-semibold capitalize">{campaign.exchange_name}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-600">{$_("trading_pair")}</span>
          <span class="text-sm font-semibold">{campaign.symbol}</span>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-100 text-sm text-blue-700 rounded-lg p-3">
        {$_("hufi_campaign_create_new_notice")}
      </div>

      <div class="flex gap-3 pt-2 pb-2">
        <button
          class="btn btn-ghost btn-md flex-1 rounded-full"
          on:click={() => (showDialog = false)}
        >
          {$_("cancel")}
        </button>
        <button
          class="btn btn-md flex-1 rounded-full bg-base-content hover:bg-base-content/90 focus:bg-base-content/90 no-animation"
          data-testid="hufi-create-continue"
          on:click={() => {
            showDialog = false;
            const params = new URLSearchParams({
              exchange: campaign.exchange_name,
              trading_pair: campaign.symbol,
            });
            goto(`/market-making/create-new?${params.toString()}`);
          }}
        >
          <span class="text-base-100 font-semibold">
            {$_("continue_to_trading_pair")}
          </span>
        </button>
      </div>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={() => (showDialog = false)}></button>
  </form>
</dialog>
