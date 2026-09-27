<script setup lang="ts">
import { useApp } from '../../composables/useApp'
import { usePwaUpdate } from '../../composables/usePwaUpdate'

const app = useApp()
const { needRefresh, updateServiceWorker } = usePwaUpdate()
</script>

<template>
  <button v-if="needRefresh" type="button" class="update" data-testid="update-prompt" @click="updateServiceWorker(true)">
    {{ app.t('update.available') }}
  </button>
</template>

<style scoped>
.update { width: 100%; min-height: var(--tap); padding: 8px 14px; border: var(--outline); border-radius: var(--radius-md); background: var(--mint); box-shadow: var(--shadow-hard-sm); font-weight: 800; }
</style>
