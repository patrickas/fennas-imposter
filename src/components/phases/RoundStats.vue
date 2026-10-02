<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import type { RoundRecord } from '../../data/storage'

const app = useApp()
// Newest first: the round just played is the one people want to look back at.
const rounds = computed(() => [...(app.state.session?.history ?? [])].reverse())
// Only scored rounds have a winner; without any, the column would be all dashes.
const showWinner = computed(() => rounds.value.some((r) => r.outcome !== null))

function winner(r: RoundRecord): string {
  if (r.outcome === null) return '—'
  return r.outcome === 'crew' ? app.t('stats.crew') : app.t('stats.imposterSide', { count: r.imposterIds.length })
}
</script>

<template>
  <section class="panel" data-testid="round-stats">
    <h3>{{ app.t('stats.title') }}</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>{{ app.t('stats.word') }}</th>
          <th>{{ app.t('stats.imposter') }}</th>
          <th>{{ app.t('stats.starter') }}</th>
          <th v-if="showWinner">{{ app.t('stats.winner') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rounds" :key="r.number" data-testid="stats-row">
          <td>{{ r.number }}</td>
          <td class="word"><bdi>{{ r.word }}</bdi></td>
          <td><bdi v-for="id in r.imposterIds" :key="id" class="name">{{ app.playerName(id) }}</bdi></td>
          <td><bdi>{{ app.playerName(r.starterId) }}</bdi></td>
          <td v-if="showWinner">{{ winner(r) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
table { width: 100%; margin-top: 8px; border-collapse: collapse; font-size: 0.9rem; }
th { font-weight: 700; text-align: start; border-bottom: 2px solid var(--ink); }
th, td { padding: 4px 0; padding-inline-end: 10px; vertical-align: top; overflow-wrap: anywhere; }
tbody tr + tr td { border-top: 1px dashed var(--ink); }
.word { color: var(--grape); font-weight: 700; }
.name { display: block; }
</style>
