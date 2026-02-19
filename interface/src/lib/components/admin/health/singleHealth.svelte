<script lang="ts">
  export let health: { name: string; state: "alive" | "dead" | "loading"; detail?: string } = {
    name: "ping",
    state: "alive",
  };

  const color = (s: string) => {
    if (s === "alive") return "text-green-500";
    if (s === "dead") return "text-red-500";
    return "text-gray-500";
  };
</script>

<div class="stats shadow">
  <div class="stat">
    <div class="stat-title">
      <span class="capitalize">{health.name}</span>
    </div>

    <div class={`stat-value my-1 mr-2 ${color(health.state)}`}>{health.state}</div>

    {#if health.detail}
      <div class="stat-desc break-words">{health.detail}</div>
    {/if}
  </div>
</div>
