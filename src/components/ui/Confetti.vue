<script setup lang="ts">
const COLORS = ['var(--sun)', 'var(--bubblegum)', 'var(--grape)', 'var(--mint)', 'var(--tangerine)']
const pieces = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  start: Math.random() * 100,
  delay: Math.random() * 0.8,
  duration: 1.6 + Math.random() * 1.2,
  color: COLORS[i % COLORS.length],
  size: 8 + Math.round(Math.random() * 8),
}))
</script>

<template>
  <div class="confetti" aria-hidden="true">
    <span
      v-for="p in pieces"
      :key="p.id"
      class="piece"
      :style="{
        insetInlineStart: `${p.start}%`,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.duration}s`,
        background: p.color,
        width: `${p.size}px`,
        height: `${p.size * 1.4}px`,
      }"
    />
  </div>
</template>

<style scoped>
.confetti { position: fixed; inset: 0; z-index: 5; overflow: hidden; pointer-events: none; }
.piece { position: absolute; top: 0; border: 2px solid var(--ink); border-radius: 3px; animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: both; }
@media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
</style>
