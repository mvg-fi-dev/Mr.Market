<script>
  import { _ } from "svelte-i18n";

  const faq = [
    {
      q: "hufi_learn_more_faq_what_is_hufi_q",
      a: "hufi_learn_more_faq_what_is_hufi_a",
    },
    { q: "hufi_learn_more_faq_problem_q", a: "hufi_learn_more_faq_problem_a" },
    {
      q: "hufi_learn_more_faq_how_it_works_q",
      a: "hufi_learn_more_faq_how_it_works_a",
    },
    { q: "hufi_learn_more_faq_benefit_q", a: "hufi_learn_more_faq_benefit_a" },
    { q: "hufi_learn_more_faq_safety_q", a: "hufi_learn_more_faq_safety_a" },
    { q: "hufi_learn_more_faq_join_q", a: "hufi_learn_more_faq_join_a" },
    { q: "hufi_learn_more_faq_create_q", a: "hufi_learn_more_faq_create_a" },
  ];
</script>

<div class="bg-base-100 min-h-screen pb-24" data-testid="hufi-learn-more">
  <div class="mx-auto w-full max-w-4xl px-4 pt-6">
    <div class="flex flex-col gap-2">
      <span class="text-2xl font-semibold text-base-content">{$_("hufi_learn_more_title")}</span>
      <span class="text-sm text-base-content/70 leading-relaxed">{$_("hufi_learn_more_intro")}</span>
    </div>

    <div class="mt-6 flex flex-col gap-3">
      <span class="text-base font-semibold text-base-content">{$_("hufi_learn_more_faq_title")}</span>

      {#each faq as item, i}
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
