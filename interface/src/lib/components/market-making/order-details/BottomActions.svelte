<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";

    export let canPause = true;
    export let canResume = false;
    export let canStop = true;
    export let canExit = true;

    const dispatch = createEventDispatcher();
</script>

<div class="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 pb-8 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
    <div class="grid grid-cols-2 gap-3">
        {#if canResume}
            <button
                class="btn btn-primary rounded-full h-12 min-h-12 text-sm font-bold normal-case"
                on:click={() => dispatch("resume")}
            >
                {$_("resume")}
            </button>
        {:else if canPause}
            <button
                class="btn bg-white hover:bg-gray-50 text-base-content border border-gray-200 rounded-full h-12 min-h-12 text-sm font-bold normal-case shadow-sm"
                on:click={() => dispatch("pause")}
            >
                {$_("pause")}
            </button>
        {/if}

        {#if canStop}
            <button
                class="btn bg-white hover:bg-gray-50 text-base-content border border-gray-200 rounded-full h-12 min-h-12 text-sm font-bold normal-case shadow-sm"
                on:click={() => dispatch("stop")}
            >
                {$_("stop")}
            </button>
        {/if}

        {#if canExit}
            <button
                class="btn bg-black hover:bg-gray-900 text-white border-none rounded-full h-12 min-h-12 text-sm font-bold normal-case shadow-lg col-span-2"
                on:click={() => dispatch("exit")}
            >
                {$_("exit")}
            </button>
        {/if}
    </div>
</div>
