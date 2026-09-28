<script setup lang="ts">
defineProps<{ title: string; testid?: string }>()
</script>

<template>
  <details class="fold">
    <!-- Starts closed; the arrow points along the reading direction when closed and down when open. -->
    <summary :data-testid="testid">
      <h2 class="grow">{{ title }}</h2>
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </summary>
    <div class="stack body"><slot /></div>
  </details>
</template>

<style scoped>
summary { display: flex; align-items: center; gap: 8px; min-height: var(--tap); cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
.arrow {
  flex: none; width: 28px; height: 28px;
  fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
  transform: rotate(-90deg); transition: transform 150ms ease;
}
[dir='rtl'] .arrow { transform: rotate(90deg); } /* not :global() — Vue would drop ".arrow" and turn the whole page */
.fold[open] .arrow { transform: none; }
.body { margin-top: 12px; }
@media (prefers-reduced-motion: reduce) { .arrow { transition: none; } }
</style>
