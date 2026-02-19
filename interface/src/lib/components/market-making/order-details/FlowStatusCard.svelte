<script lang="ts">
  import type { MarketMakingState } from "$lib/helpers/mrm/marketMakingState";
  import {
    getMarketMakingFlowSteps,
    getMarketMakingStateDisplay,
  } from "$lib/helpers/mrm/marketMakingState";

  export let state: MarketMakingState | null | undefined;

  $: display = getMarketMakingStateDisplay(state);
  $: steps = getMarketMakingFlowSteps(state);

  $: toneClass =
    display.tone === 'success'
      ? 'bg-green-50 text-green-600 border-green-100'
      : display.tone === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : display.tone === 'error'
          ? 'bg-red-50 text-red-600 border-red-100'
          : 'bg-blue-50 text-blue-600 border-blue-100';
</script>

<div class="mx-4 mt-4">
  <div class={`rounded-2xl border p-4 bg-white shadow-sm`}>
    <div class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${toneClass}`}>
      {display.label}
    </div>

    <div class="mt-2 text-sm text-base-content/70">
      {display.hint}
    </div>

    <div class="mt-4">
      <div class="flex items-center gap-2">
        {#each steps as s, i}
          <div class="flex items-center gap-2">
            <div
              class={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                s.done
                  ? 'bg-green-500 text-white border-green-500'
                  : s.active
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-base-100 text-base-content/50 border-base-200'
              }`}
            >
              {i + 1}
            </div>
            <div class={`text-xs font-semibold ${s.active ? 'text-base-content' : 'text-base-content/60'}`}>
              {s.title}
            </div>
          </div>
          {#if i < steps.length - 1}
            <div class="flex-1 h-[2px] bg-base-200" />
          {/if}
        {/each}
      </div>
    </div>

    <div class="mt-3 text-xs text-base-content/50">
      Current state: {state || '---'}
    </div>
  </div>
</div>
