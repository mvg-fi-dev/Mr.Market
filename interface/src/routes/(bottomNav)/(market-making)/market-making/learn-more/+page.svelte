<script>
  import { _ } from "svelte-i18n";

  const faq = [
    {
      q: "market_making_learn_more_faq_what_is_market_making_q",
      a: "market_making_learn_more_faq_what_is_market_making_a",
    },
    {
      q: "market_making_learn_more_faq_why_it_matters_q",
      a: "market_making_learn_more_faq_why_it_matters_a",
    },
    {
      q: "market_making_learn_more_faq_benefit_project_q",
      a: "market_making_learn_more_faq_benefit_project_a",
    },
    {
      q: "market_making_learn_more_faq_what_is_mrmarket_q",
      a: "market_making_learn_more_faq_what_is_mrmarket_a",
    },
    {
      q: "market_making_learn_more_faq_get_started_q",
      a: "market_making_learn_more_faq_get_started_a",
    },
    {
      q: "market_making_learn_more_faq_risks_q",
      a: "market_making_learn_more_faq_risks_a",
    },
    {
      q: "market_making_learn_more_faq_safety_q",
      a: "market_making_learn_more_faq_safety_a",
    },
  ];
</script>

<div class="bg-base-100 min-h-screen pb-24" data-testid="market-making-learn-more">
  <div class="mx-auto w-full max-w-4xl px-4 pt-6">
    <div class="flex flex-col gap-2">
      <span class="text-2xl font-semibold text-base-content">{$_("market_making_learn_more_title")}</span>
      <span class="text-sm text-base-content/70 leading-relaxed">{$_("market_making_learn_more_intro")}</span>
    </div>

    <div class="mt-6 flex flex-col gap-3">
      <span class="text-base font-semibold text-base-content">{$_("market_making_learn_more_faq_title")}</span>

      {#each faq as item}
        <details class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-2xl">
          <summary class="collapse-title">
            <span class="text-base font-medium text-base-content">{$_(item.q)}</span>
          </summary>
          <div class="collapse-content">
            <span class="text-sm text-base-content/70 leading-relaxed">{$_(item.a)}</span>
          </div>
        </details>
      {/each}
    </div>
  </div>
</div>
