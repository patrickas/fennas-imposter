<script setup lang="ts">
defineProps<{ label: string; testid?: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="toggle" :data-testid="testid">
    <input v-model="model" type="checkbox" class="visually-hidden">
    <span class="track" aria-hidden="true"><span class="thumb" /></span>
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle { display: flex; align-items: center; gap: 12px; min-height: var(--tap); font-weight: 700; cursor: pointer; }
.track { position: relative; flex: none; width: 56px; height: 32px; border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); }
.thumb { position: absolute; top: 3px; inset-inline-start: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ink); }
input:checked + .track { background: var(--mint); }
input:checked + .track .thumb { inset-inline-start: 27px; }
input:focus-visible + .track { outline: 3px solid var(--grape); outline-offset: 3px; }
</style>
