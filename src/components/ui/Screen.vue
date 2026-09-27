<script setup lang="ts">
import BgShapes from './BgShapes.vue'

withDefaults(defineProps<{ tone?: 'sun' | 'bubblegum' | 'mint'; align?: 'center' | 'start' }>(), {
  tone: 'sun',
  align: 'center',
})
</script>

<template>
  <main class="screen" :class="`tone-${tone}`">
    <BgShapes />
    <div class="inner">
      <header v-if="$slots.top" class="top"><slot name="top" /></header>
      <section class="body" :class="`align-${align}`"><slot /></section>
      <footer v-if="$slots.actions" class="actions"><slot name="actions" /></footer>
    </div>
  </main>
</template>

<style scoped>
.screen { position: relative; min-height: 100dvh; overflow: hidden; }
.tone-sun { background: var(--sun); }
.tone-bubblegum { background: var(--bubblegum); }
.tone-mint { background: var(--mint); }
.inner {
  position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px;
  max-width: var(--max-width); min-height: 100dvh; margin-inline: auto;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
}
.top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.body { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.align-center { justify-content: center; }
.align-start { justify-content: flex-start; }
.actions { display: flex; flex-direction: column; gap: 10px; }
</style>
