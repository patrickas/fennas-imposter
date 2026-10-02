<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import { useTimer } from '../../composables/useTimer'
import { formatClock } from '../../i18n'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'
import ImposterCountChip from './ImposterCountChip.vue'
import LevelChip from './LevelChip.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
const timer = useTimer(
  () => round.value?.timerEndsAt ?? null,
  () => {
    sound.beep()
    navigator.vibrate?.([300, 150, 300])
  },
)
// Screen readers: announce once per minute, then at 10 s, then at time-up.
const announcement = computed(() => {
  const view = timer.value
  if (!view.active) return ''
  if (view.ended) return app.t('discussion.timeUp')
  if (view.secondsLeft <= 10) return app.t('timer.secondsLeft', { count: 10 })
  return app.t('timer.minutesLeft', { count: Math.ceil(view.secondsLeft / 60) })
})

function end(): void {
  app.dispatch({ type: 'endDiscussion' })
}
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="discussion" @pointerdown="sound.prime()">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
      <LevelChip />
      <ImposterCountChip />
      <LeaveRoundButton />
    </template>
    <!-- Waits here while the group plays: clues go round, then the discussion. -->
    <StickerCard motion="wobble">
      <p class="title-xl" data-testid="playing">{{ app.t('discussion.playing') }}</p>
      <span class="dots" aria-hidden="true">
        <span class="dot anim-loop" /><span class="dot anim-loop" /><span class="dot anim-loop" />
      </span>
    </StickerCard>
    <p class="guide">{{ app.t('discussion.playingGuide') }}</p>
    <div v-if="timer.active" class="timer" :class="{ ended: timer.ended }" data-testid="timer">
      {{ timer.ended ? app.t('discussion.timeUp') : formatClock(timer.secondsLeft) }}
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
    <template #actions>
      <PopButton attention data-testid="end-discussion" @click="end">
        {{ round.settings.scoring ? app.t('discussion.toVote') : app.t('discussion.toReveal') }}
      </PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.timer {
  align-self: center; min-width: 8ch; padding: 6px 20px;
  border: var(--outline); border-radius: var(--radius-pill); background: var(--paper); box-shadow: var(--shadow-hard-sm);
  font-size: 2.2rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; direction: ltr;
}
.timer.ended { background: var(--bubblegum); }
.dots { display: inline-flex; gap: 10px; margin-top: 12px; }
.dot { width: 14px; height: 14px; border: 2px solid var(--ink); border-radius: 50%; background: var(--grape); animation: dot-bounce 1.2s ease-in-out infinite; }
.dot:nth-child(2) { background: var(--bubblegum); animation-delay: 0.15s; }
.dot:nth-child(3) { background: var(--mint); animation-delay: 0.3s; }
@keyframes dot-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
</style>
