<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { formatList } from '../../i18n'
import type { RoundRecord } from '../../data/storage'

const app = useApp()
// Newest first: the round just played is the one people want to look back at.
const rounds = computed(() => [...(app.state.session?.history ?? [])].reverse())

function winner(r: RoundRecord): string {
  if (r.outcome === 'crew') return app.t('stats.crewWon')
  return app.t('stats.impostersWon', { count: r.imposterIds.length })
}
</script>

<template>
  <section class="panel" data-testid="round-stats">
    <h3>{{ app.t('stats.title') }}</h3>
    <ol class="rows">
      <li v-for="r in rounds" :key="r.number" class="round" data-testid="stats-row">
        <div class="head">
          <span class="number">{{ app.t('play.round', { n: r.number }) }}</span>
          <span class="word" dir="auto" data-testid="stats-word">{{ r.word }}</span>
        </div>
        <p data-testid="stats-imposters">
          {{ app.t('stats.imposters', { count: r.imposterIds.length, names: formatList(r.imposterIds.map(app.playerName), app.state.language) }) }}
        </p>
        <p data-testid="stats-starter">{{ app.t('stats.starter', { name: app.playerName(r.starterId) }) }}</p>
        <p v-if="r.outcome" class="winner" data-testid="stats-winner">{{ winner(r) }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 12px; margin: 8px 0 0; padding: 0; list-style: none; }
.round { display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.round + .round { padding-top: 12px; border-top: 2px dashed currentColor; }
.head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; }
.number { white-space: nowrap; }
.word { min-width: 0; color: var(--grape); font-size: 1.2rem; }
.winner { font-weight: 700; }
</style>
