<template>
  <span class="chip"><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-flex; align-items: center; min-height: 32px; padding: 2px 14px;
  border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm);
  font-size: 0.9rem; font-weight: 700; overflow-wrap: anywhere;
}
</style>
