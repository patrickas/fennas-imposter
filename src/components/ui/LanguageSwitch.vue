<script setup lang="ts">
import { LANGS } from '../../engine/types'
import { useApp } from '../../composables/useApp'

const app = useApp()
</script>

<template>
  <div v-if="!app.state.round" class="lang-switch" role="group" :aria-label="app.t('home.language')">
    <button
      v-for="lang in LANGS"
      :key="lang"
      type="button"
      class="lang"
      :class="{ active: app.state.language === lang }"
      :aria-pressed="app.state.language === lang"
      :lang="lang"
      :data-testid="`lang-${lang}`"
      @click="app.setLanguage(lang)"
    >
      {{ app.t(`lang.${lang}`) }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch { display: inline-flex; overflow: hidden; border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm); }
.lang { min-height: 40px; padding: 4px 14px; border: 0; background: transparent; font-weight: 800; }
.lang.active { background: var(--ink); color: var(--sun); }
</style>
