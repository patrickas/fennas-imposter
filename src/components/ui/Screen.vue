<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import BgShapes from './BgShapes.vue'

withDefaults(defineProps<{ tone?: 'sun' | 'bubblegum' | 'mint'; align?: 'center' | 'start'; stickyActions?: boolean }>(), {
  tone: 'sun',
  align: 'center',
})

/**
 * Every screen puts its primary action in the same bottom spot, so a double tap (or an impatient
 * re-tap) would land on the next screen's button — showing a card to the wrong player or skipping
 * part of the round. The actions stay inert for a moment after a screen appears. Time-based, not
 * animation-based, so it also holds with reduced motion.
 */
const ARM_DELAY_MS = 500
const armed = ref(false)
let armTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  armTimer = setTimeout(() => (armed.value = true), ARM_DELAY_MS)
})
onUnmounted(() => clearTimeout(armTimer))
</script>

<template>
  <main class="screen" :class="`tone-${tone}`">
    <BgShapes />
    <div class="inner">
      <header v-if="$slots.top" class="top"><slot name="top" /></header>
      <section class="body" :class="`align-${align}`"><slot /></section>
      <footer v-if="$slots.actions" class="actions" :class="{ sticky: stickyActions }" :inert="!armed"><slot name="actions" /></footer>
    </div>
  </main>
</template>

<style scoped>
/* clip, not hidden: hidden makes .screen a scroll container, which stops sticky actions from sticking. hidden stays as the fallback. */
.screen { position: relative; min-height: 100dvh; overflow: hidden; overflow: clip; background: var(--tone); }
.tone-sun { --tone: var(--sun); }
.tone-bubblegum { --tone: var(--bubblegum); }
.tone-mint { --tone: var(--mint); }
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
/* A strip of the screen's colour, so the page scrolls under it; the negative margins cover .inner's gutters and bottom padding. */
.actions.sticky {
  position: sticky; bottom: 0; z-index: 1;
  margin: 0 -16px calc(-20px - env(safe-area-inset-bottom));
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--tone);
}
</style>
