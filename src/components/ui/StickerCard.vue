<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'paper' | 'ink'; motion?: 'none' | 'wobble' | 'shake' }>(), {
  tone: 'paper',
  motion: 'none',
})
</script>

<template>
  <div class="sticker" :class="[`tone-${tone}`, motion !== 'none' && ['anim-loop', `anim-${motion}`]]">
    <slot />
  </div>
</template>

<style scoped>
.sticker {
  max-width: 100%; margin-inline: auto; padding: 18px 22px;
  border: var(--outline); border-radius: var(--radius-lg); box-shadow: var(--shadow-hard);
  text-align: center; overflow-wrap: anywhere;
}
.tone-paper { background: var(--paper); color: var(--ink); }
.tone-ink { background: var(--ink); color: var(--sun); }
</style>
