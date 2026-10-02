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
      <span class="title-xl" data-testid="pass-name" dir="auto">{{ name }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('reveal.passGuide', { name }) }}</p>
    <template #actions>
      <PopButton attention data-testid="show-card" @click="shown = true">{{ app.t('reveal.show', { name }) }}</PopButton>
    </template>
  </Screen>

  <Screen v-else-if="round" tone="mint" data-testid="card-screen">
    <!-- Same screen, card and motion for every role: bystanders must not read a role from colour or movement.
         (Comments stay inside the Screen: a root-level comment makes this a multi-root component in dev
         builds, and <Transition mode="out-in"> then never finishes — a blank page.) -->
    <template #top>
      <Chip class="name-chip"><bdi class="card-name">{{ name }}</bdi></Chip>
    </template>
    <!-- Both cards: a big title line, then one second line (and the category, when shown) — the same shape for every role. -->
    <StickerCard v-if="isImposter" motion="wobble">
      <p class="secret-word" data-testid="imposter-title">{{ app.t('reveal.imposterTitle') }}</p>
      <p v-if="round.settings.hints && round.secret" class="secret-word reveal-line" data-testid="imposter-hint">
        {{ app.t('reveal.hint', { hint: imposterHint(round.secret) }) }}
      </p>
      <p v-else class="secret-word reveal-line">{{ app.t('reveal.noHint') }}</p>
      <p v-if="round.settings.showCategory && round.secret" class="category-line" data-testid="card-category">
        {{ app.t('result.category', { category: round.secret.categoryName }) }}
      </p>
    </StickerCard>
    <StickerCard v-else motion="wobble">
      <p class="secret-word" data-testid="crew-title">{{ app.t('reveal.secretWordIs') }}</p>
      <p class="secret-word reveal-line" data-testid="secret-word">{{ round.secret?.word }}</p>
      <p v-if="round.settings.showCategory && round.secret" class="category-line" data-testid="card-category">
        {{ app.t('result.category', { category: round.secret.categoryName }) }}
      </p>
    </StickerCard>
    <p class="guide">{{ isImposter ? app.t('reveal.imposterGuide') : app.t('reveal.crewGuide') }}</p>
    <template #actions>
      <PopButton data-testid="hide-pass" @click="hideAndPass">{{ app.t('reveal.hidePass') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.lead { font-size: 1.3rem; font-weight: 700; }
.name-chip { margin-inline: auto; }
.card-name { font-size: 2rem; font-weight: 800; }
.reveal-line { margin-top: 12px; color: var(--grape); }
.category-line { margin-top: 10px; font-size: 1.2rem; font-weight: 700; overflow-wrap: anywhere; }
</style>
