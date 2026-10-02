<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Chip from '../ui/Chip.vue'

const app = useApp()
// Absent in Game Master rounds (and rounds saved before levels existed): no badge then.
// The same chip for every player: it says how hard the round is, never which kind of hard round.
const level = computed(() => app.state.round?.secret?.level)
</script>

<template>
  <Chip v-if="level" :class="`level-${level}`" data-testid="level-chip">
    {{ app.t(level === 'hard' ? 'difficulty.hard' : 'difficulty.easy') }}
  </Chip>
</template>

<style scoped>
.level-hard { background: var(--tangerine); }
</style>
