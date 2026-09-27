<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit'; attention?: boolean; disabled?: boolean }>(),
  { variant: 'primary', type: 'button', attention: false, disabled: false },
)
</script>

<template>
  <button :type="type" class="pop-btn" :class="[variant, { 'anim-loop anim-squish': attention && !disabled }]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.pop-btn {
  width: 100%; min-height: var(--tap); padding: 10px 16px;
  border: var(--outline); border-radius: var(--radius-md); box-shadow: var(--shadow-hard-sm);
  font-size: 1.15rem; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere;
  transition: transform 80ms ease;
}
.primary { background: var(--grape); color: var(--paper); }
.secondary { background: var(--paper); color: var(--ink); }
.danger { background: var(--bubblegum); color: var(--ink); }
/* Pressed: slide onto the shadow. The shadow switch is instant (not animated). */
.pop-btn:active:not(:disabled) { transform: translate(var(--shadow-x-sm), 3px); box-shadow: none; }
.pop-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
