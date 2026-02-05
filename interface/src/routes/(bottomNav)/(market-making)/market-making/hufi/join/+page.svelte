<script lang="ts">
  import { goto } from "$app/navigation";
  import { _ } from "svelte-i18n";
</script>

<div class="flex flex-col min-h-screen bg-base-100">
  <div class="px-6 pt-8 pb-4">
    <h1 class="text-2xl font-bold">{$_("hufi_join_title")}</h1>
    <p class="text-sm text-base-content/70 mt-2">
      {$_("hufi_join_placeholder")}
    </p>
  </div>

  <div class="flex-1 px-6">
    <div class="border border-base-200 rounded-2xl p-6 bg-base-100">
      <div class="text-base font-semibold">{$_("hufi_join_coming_soon")}</div>
      <p class="text-sm text-base-content/70 mt-2">
        {$_("hufi_join_coming_soon_desc")}
      </p>
    </div>
  </div>

  <div class="px-6 pb-8 pt-6">
    <button
      class="btn btn-ghost rounded-full border border-base-300 w-full"
      on:click={() => goto("/market-making/hufi")}
    >
      {$_("back_to_campaigns")}
    </button>
  </div>
</div>
