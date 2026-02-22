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
</script>

<div class="mx-4 mt-4">
  <div class="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
    <div class="flex items-center justify-between">
      <div class="text-sm font-bold text-gray-500">Timeline (durable facts)</div>
      <div class="text-xs text-base-content/50">{items.length} events</div>
    </div>

    {#if items.length === 0}
      <div class="mt-3 text-sm text-base-content/60">
        No timeline events yet.
      </div>
    {:else}
      <div class="mt-3 space-y-3">
        {#each items as item}
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
