<script context="module" lang="ts">
  export type TimelineItem = {
    id: string;
    ts: number;
    title: string;
    detail?: string;
    tone?: 'info' | 'success' | 'warning' | 'error';
    topic?: string;
    meta?: Record<string, string>;
  };
</script>

<script lang="ts">
  export let items: import('./LifecycleTimeline.svelte').TimelineItem[] = [];

  export let defaultFilter: 'all' | 'errors' | 'outbox' | 'ledger' = 'all';

  let filter: 'all' | 'errors' | 'outbox' | 'ledger' = defaultFilter;

  const fmt = (ts: number) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '---';
    }
  };

  const toneClass = (tone?: TimelineItem['tone']) => {
    if (tone === 'success') return 'bg-green-50 border-green-100 text-green-700';
    if (tone === 'warning') return 'bg-amber-50 border-amber-100 text-amber-800';
    if (tone === 'error') return 'bg-red-50 border-red-100 text-red-700';
    return 'bg-blue-50 border-blue-100 text-blue-700';
  };

  const isErrorItem = (item: TimelineItem) =>
    item.tone === 'error' ||
    Boolean(item.topic && (item.topic.includes('.failed') || item.topic.includes('.timeout')));

  $: visibleItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'errors') return isErrorItem(item);
    if (filter === 'outbox') return Boolean(item.id && item.id.startsWith('outbox:'));
    if (filter === 'ledger') return Boolean(item.id && item.id.startsWith('ledger:'));
    return true;
  });
</script>

<div class="mx-4 mt-4">
  <div class="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm font-bold text-gray-500">Timeline (durable facts)</div>
      <div class="flex items-center gap-2">
        <button
          class={`btn btn-xs ${filter === 'all' ? 'btn-neutral' : 'btn-ghost'}`}
          on:click={() => (filter = 'all')}
        >
          All
        </button>
        <button
          class={`btn btn-xs ${filter === 'errors' ? 'btn-error' : 'btn-ghost'}`}
          on:click={() => (filter = 'errors')}
        >
          Errors
        </button>
        <button
          class={`btn btn-xs ${filter === 'outbox' ? 'btn-neutral' : 'btn-ghost'}`}
          on:click={() => (filter = 'outbox')}
        >
          Outbox
        </button>
        <button
          class={`btn btn-xs ${filter === 'ledger' ? 'btn-neutral' : 'btn-ghost'}`}
          on:click={() => (filter = 'ledger')}
        >
          Ledger
        </button>

        <div class="text-xs text-base-content/50 whitespace-nowrap">
          {visibleItems.length}/{items.length}
        </div>
      </div>
    </div>

    {#if visibleItems.length === 0}
      <div class="mt-3 text-sm text-base-content/60">
        No timeline events yet.
      </div>
    {:else}
      <div class="mt-3 space-y-3">
        {#each visibleItems as item}
          <div class={`border rounded-xl p-3 ${toneClass(item.tone)}`}>
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-bold">{item.title}</div>
                {#if item.detail}
                  <div class="mt-1 text-xs opacity-80">{item.detail}</div>
                {/if}
              </div>
              <div class="text-[11px] font-mono opacity-70">{fmt(item.ts)}</div>
            </div>

            {#if item.topic}
              <div class="mt-2 text-[11px] font-mono opacity-70">{item.topic}</div>
            {/if}

            {#if item.meta && Object.keys(item.meta).length > 0}
              <div class="mt-2 flex flex-wrap gap-2">
                {#each Object.entries(item.meta) as [k, v]}
                  <div class="px-2 py-1 rounded-full bg-white/60 border border-white/60 text-[11px]">
                    <span class="font-mono opacity-70">{k}</span>
                    <span class="ml-1 font-mono">{v}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
