<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Source } from '../../engine/types'
import { useApp } from '../../composables/useApp'
import type { MessageKey } from '../../i18n'
import { confirmDialog } from '../../composables/useDialog'
import Screen from '../ui/Screen.vue'
import Chip from '../ui/Chip.vue'
import PopButton from '../ui/PopButton.vue'
import LanguageSwitch from '../ui/LanguageSwitch.vue'
import Scoreboard from './Scoreboard.vue'

type SourceKind = Source['kind']
const SOURCES: { kind: SourceKind; label: MessageKey }[] = [
  { kind: 'random', label: 'play.sourceRandom' },
  { kind: 'playerGm', label: 'play.sourcePlayerGm' },
  { kind: 'outsideGm', label: 'play.sourceOutsideGm' },
]

const app = useApp()
const router = useRouter()

const kind = ref<SourceKind>('random')
const activePlayers = computed(() => app.state.players.filter((p) => app.state.activePlayerIds.includes(p.id)))
const gmId = ref(activePlayers.value[0]?.id ?? '')
watch(activePlayers, (list) => {
  if (!list.some((p) => p.id === gmId.value)) gmId.value = list[0]?.id ?? ''
})

const source = computed<Source>(() => {
  if (kind.value === 'playerGm') return { kind: 'playerGm', gmPlayerId: gmId.value }
  if (kind.value === 'outsideGm') return { kind: 'outsideGm' }
  return { kind: 'random' }
})
const blocker = computed(() => app.roundBlocker(source.value))
const blockerText = computed(() => {
  switch (blocker.value) {
    case 'needPlayers':
      return app.t('play.needPlayers')
    case 'noWords':
      return app.t('play.noWords')
    case 'noGm':
      return app.t('play.pickGm')
    default:
      return null
  }
})
const clamped = computed(() => app.clampedImposterCount(source.value))
const roundNumber = computed(() => (app.state.session?.rounds ?? 0) + 1)
const showScores = computed(() => app.state.settings.scoring && Object.keys(app.state.session?.scores ?? {}).length > 0)

function start(): void {
  app.beginRound(source.value)
}

async function endGame(): Promise<void> {
  const confirmed = await confirmDialog({
    message: app.t('play.endGameConfirm'),
    confirmLabel: app.t('play.endGame'),
    cancelLabel: app.t('common.cancel'),
    danger: true,
  })
  if (!confirmed) return
  app.endSession()
  void router.push('/')
}
</script>

<template>
  <Screen tone="sun" data-testid="between-rounds">
    <template #top>
      <Chip>{{ app.t('play.round', { n: roundNumber }) }}</Chip>
      <LanguageSwitch />
    </template>

    <section class="panel stack">
      <h2>{{ app.t('play.wordSource') }}</h2>
      <div class="sources" role="radiogroup" :aria-label="app.t('play.wordSource')">
        <label v-for="s in SOURCES" :key="s.kind" class="source" :class="{ chosen: kind === s.kind }">
          <input v-model="kind" type="radio" name="source" :value="s.kind" :data-testid="`source-${s.kind}`">
          <span>{{ app.t(s.label) }}</span>
        </label>
      </div>
      <label v-if="kind === 'playerGm'" class="field">
        {{ app.t('play.pickGm') }}
        <select v-model="gmId" class="input" data-testid="gm-select">
          <option v-for="p in activePlayers" :key="p.id" :value="p.id" dir="auto">{{ p.name }}</option>
        </select>
      </label>
    </section>

    <p v-if="blockerText" class="guide" data-testid="round-blocker">{{ blockerText }}</p>
    <p v-else-if="clamped !== null" class="guide" data-testid="clamp-notice">{{ app.t('play.clamped', { count: clamped }) }}</p>

    <Scoreboard v-if="showScores" />

    <template #actions>
      <PopButton attention :disabled="blocker !== null" data-testid="start-round" @click="start">
        {{ app.t('play.startRound') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="edit-setup" @click="router.push('/setup')">{{ app.t('play.editSetup') }}</PopButton>
      <PopButton variant="danger" data-testid="end-game" @click="endGame">{{ app.t('play.endGame') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.sources { display: flex; flex-direction: column; gap: 8px; }
.source { display: flex; align-items: center; gap: 10px; min-height: var(--tap); padding: 6px 12px; border: var(--outline); border-radius: var(--radius-sm); font-weight: 700; }
.source.chosen { background: var(--sun); }
.source input { width: 22px; height: 22px; accent-color: var(--grape); }
</style>
