<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'

const app = useApp()
const rows = computed(() =>
  Object.entries(app.state.session?.scores ?? {})
    .map(([id, row]) => ({
      id,
      name: app.state.players.find((p) => p.id === id)?.name ?? row.name,
      points: row.points,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
)
</script>

<template>
  <section class="panel" data-testid="scoreboard">
    <h3>{{ app.t('result.scores') }}</h3>
    <ol class="rows">
      <li v-for="row in rows" :key="row.id" class="score" data-testid="score-row">
        <span class="name" dir="auto">{{ row.name }}</span>
        <span class="points">{{ app.t('result.points', { count: row.points }) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.score { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; }
.name { min-width: 0; overflow-wrap: anywhere; }
.points { white-space: nowrap; }
</style>
