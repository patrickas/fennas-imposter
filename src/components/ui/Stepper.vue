<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    min: number
    max: number
    step?: number
    label: string
    decreaseLabel: string
    increaseLabel: string
    display?: string
    disabled?: boolean
    testid?: string
  }>(),
  { step: 1, display: undefined, disabled: false, testid: undefined },
)
const model = defineModel<number>({ required: true })

function change(delta: number): void {
  model.value = Math.min(props.max, Math.max(props.min, model.value + delta))
}
</script>

<template>
  <div class="stepper" :class="{ off: disabled }">
    <span class="label">{{ label }}</span>
    <div class="controls">
      <button type="button" class="icon-btn" :aria-label="decreaseLabel" :disabled="disabled || model <= min" :data-testid="testid && `${testid}-dec`" @click="change(-step)">−</button>
      <output class="value" :data-testid="testid && `${testid}-value`">{{ display ?? model }}</output>
      <button type="button" class="icon-btn" :aria-label="increaseLabel" :disabled="disabled || model >= max" :data-testid="testid && `${testid}-inc`" @click="change(step)">+</button>
    </div>
  </div>
</template>

<style scoped>
.stepper { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: var(--tap); font-weight: 700; }
.stepper.off { opacity: 0.5; }
.controls { display: flex; align-items: center; gap: 8px; }
.value { min-width: 4ch; font-size: 1.3rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; direction: ltr; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
