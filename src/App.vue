<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useApp } from './composables/useApp'
import { dirFor } from './i18n'
import StatusBanner from './components/ui/StatusBanner.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import { usePwaUpdate } from './composables/usePwaUpdate'

const app = useApp()
usePwaUpdate()

watchEffect(() => {
  document.documentElement.lang = app.state.language
  document.documentElement.dir = dirFor(app.state.language)
  document.title = app.t('app.title')
})
</script>

<template>
  <StatusBanner />
  <RouterView v-slot="{ Component }">
    <Transition name="pop" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <ConfirmDialog />
</template>
