<script lang="ts">
  import { onMount } from "svelte";

  import SingleHealth from "$lib/components/admin/health/singleHealth.svelte";
  import { getSystemStatus, type SystemStatus } from "$lib/helpers/mrm/health";

  type HealthItem = {
    name: string;
    state: "alive" | "dead" | "loading";
    detail?: string;
  };

  let items: HealthItem[] = [
    { name: "tick loop", state: "loading" },
    { name: "snapshots queue", state: "loading" },
    { name: "market-making queue", state: "loading" },
  ];

  const toState = (ok: boolean) => (ok ? "alive" : "dead");

  const formatIssues = (issues?: string[]) => {
    if (!issues || issues.length === 0) return undefined;
    return issues.join("; ");
  };

  const refresh = async () => {
    try {
      const status: SystemStatus = await getSystemStatus();

      const next: HealthItem[] = [
        {
          name: "tick loop",
          state: toState(status.tick.running && status.tick.recentlyTicked),
          detail: status.tick.running
            ? status.tick.recentlyTicked
              ? "running"
              : "stale"
            : "not running",
        },
        {
          name: "snapshots queue",
          state: toState(!status.queues.snapshots.isPaused),
          detail: status.queues.snapshots.isPaused ? "paused" : "ok",
        },
        {
          name: "market-making queue",
          state: toState(!status.queues.marketMaking.isPaused),
          detail: status.queues.marketMaking.isPaused ? "paused" : "ok",
        },
      ];

      const issuesDetail = formatIssues(status.issues);
      if (issuesDetail) {
        next.push({ name: "issues", state: status.ok ? "alive" : "dead", detail: issuesDetail });
      }

      items = next;
    } catch (e) {
      items = [
        {
          name: "system status",
          state: "dead",
          detail: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  };

  onMount(() => {
    refresh();
    const id = setInterval(() => {
      refresh();
    }, 10_000);

    return () => clearInterval(id);
  });
</script>

<div
  class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 justify-center items-center gap-4"
>
  {#each items as item}
    <SingleHealth health={item} />
  {/each}
</div>
