<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import type { MessageKey } from '../../i18n'

const app = useApp()
const message = computed<MessageKey | null>(() => {
  const { status, noticeDismissed } = app.meta
  if (status === 'unavailable') return 'storage.unavailable' // persistent: never dismissible
  if (noticeDismissed) return null
  if (status === 'corrupt') return 'storage.corrupt'
  if (status === 'newer') return 'storage.newer'
  return null
})
</script>

<template>
  <div v-if="message" class="banner" role="alert" data-testid="status-banner">
    <span>{{ app.t(message) }}</span>
    <button v-if="app.meta.status !== 'unavailable'" type="button" class="dismiss" @click="app.dismissNotice()">
      {{ app.t('common.dismiss') }}
    </button>
  </div>
</template>

<style scoped>
.banner { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--ink); color: var(--sun); font-weight: 700; }
.dismiss { flex: none; min-height: 40px; padding: 4px 14px; border: 2px solid var(--sun); border-radius: var(--radius-pill); background: transparent; color: var(--sun); font-weight: 800; }
</style>
