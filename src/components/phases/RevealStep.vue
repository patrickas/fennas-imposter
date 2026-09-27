<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import { imposterHint } from '../../engine/words'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
// Clamped: while this instance is leaving, revealIndex may already point past the last player.
const playerId = computed(() => {
  const r = round.value
  if (!r) return ''
  return r.participantIds[Math.min(r.revealIndex, r.participantIds.length - 1)] ?? ''
})
const name = computed(() => app.playerName(playerId.value))
const isImposter = computed(() => round.value?.imposterIds.includes(playerId.value) ?? false)
const shown = ref(false)

function hideAndPass(): void {
  const r = round.value
  if (!r) return
  shown.value = false
  if (r.revealIndex === r.participantIds.length - 1) sound.prime() // last tap before the timer: unlock audio
  app.dispatch({ type: 'cardSeen', now: Date.now() })
}
</script>

<template>
  <Screen v-if="round && !shown" tone="sun" data-testid="pass-screen">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
      <LeaveRoundButton />
    </template>
    <p class="center lead">{{ app.t('reveal.passTo') }}</p>
    <StickerCard motion="wobble">
      <span class="title-xl" data-testid="pass-name">{{ name }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('reveal.passGuide', { name }) }}</p>
    <template #actions>
      <PopButton attention data-testid="show-card" @click="shown = true">{{ app.t('reveal.show', { name }) }}</PopButton>
    </template>
  </Screen>

  <!-- Same screen, card and motion for every role: bystanders must not read a role from colour or movement. -->
  <Screen v-else-if="round" tone="mint" data-testid="card-screen">
    <template #top>
      <Chip>{{ name }}</Chip>
    </template>
    <StickerCard v-if="isImposter" motion="wobble">
      <p class="secret-word" data-testid="imposter-title">{{ app.t('reveal.imposterTitle') }}</p>
      <p v-if="round.settings.hints && round.secret" class="hint" data-testid="imposter-hint">
        {{ app.t('reveal.hint', { hint: imposterHint(round.secret) }) }}
      </p>
    </StickerCard>
    <StickerCard v-else motion="wobble">
      <p class="secret-word" data-testid="secret-word">{{ round.secret?.word }}</p>
    </StickerCard>
    <p class="guide">{{ isImposter ? app.t('reveal.imposterGuide') : app.t('reveal.crewGuide') }}</p>
    <template #actions>
      <PopButton data-testid="hide-pass" @click="hideAndPass">{{ app.t('reveal.hidePass') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.lead { font-size: 1.3rem; font-weight: 700; }
.hint { margin-top: 12px; font-size: 1.1rem; font-weight: 700; overflow-wrap: anywhere; }
</style>
