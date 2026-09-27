<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Chip from '../ui/Chip.vue'

const app = useApp()
const round = computed(() => app.state.round)
</script>

<template>
  <Chip v-if="round" data-testid="imposter-count">
    {{ round.settings.imposterCountHidden
      ? app.t('discussion.impostersHidden')
      : app.t('discussion.imposters', { count: round.imposterIds.length }) }}
  </Chip>
</template>
