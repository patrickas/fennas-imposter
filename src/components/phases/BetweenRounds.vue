<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../../composables/useApp'
import { confirmDialog } from '../../composables/useDialog'
import Screen from '../ui/Screen.vue'
import Chip from '../ui/Chip.vue'
import PopButton from '../ui/PopButton.vue'
import StickerCard from '../ui/StickerCard.vue'
import LanguageSwitch from '../ui/LanguageSwitch.vue'
import Scoreboard from './Scoreboard.vue'
import RoundStats from './RoundStats.vue'

const app = useApp()
const router = useRouter()

// Where the word comes from is chosen in Setup → Settings.
const source = computed(() => app.roundSource())
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
const hasStats = computed(() => (app.state.session?.history?.length ?? 0) > 0)
const statsOpen = ref(false)

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

    <StickerCard motion="wobble" data-testid="title-card">
      <h1 class="title-xl">{{ app.t('app.title') }}</h1>
    </StickerCard>

    <p v-if="blockerText" class="guide" data-testid="round-blocker">{{ blockerText }}</p>
    <p v-else-if="clamped !== null" class="guide" data-testid="clamp-notice">{{ app.t('play.clamped', { count: clamped }) }}</p>

    <Scoreboard v-if="showScores" />
    <RoundStats v-if="hasStats && statsOpen" />

    <template #actions>
      <PopButton attention :disabled="blocker !== null" data-testid="start-round" @click="start">
        {{ app.t('play.startRound') }}
      </PopButton>
      <PopButton v-if="hasStats" variant="secondary" data-testid="view-stats" @click="statsOpen = !statsOpen">
        {{ app.t(statsOpen ? 'play.hideStats' : 'play.viewStats') }}
      </PopButton>
      <PopButton variant="secondary" data-testid="edit-setup" @click="router.push('/setup')">{{ app.t('play.editSetup') }}</PopButton>
      <PopButton variant="danger" data-testid="end-game" @click="endGame">{{ app.t('play.endGame') }}</PopButton>
    </template>
  </Screen>
</template>
