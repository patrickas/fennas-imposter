<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import { useSound } from '../../composables/useSound'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'
import ImposterCountChip from './ImposterCountChip.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const app = useApp()
const sound = useSound()
const round = computed(() => app.state.round)
const starter = computed(() => (round.value ? app.playerName(round.value.startingPlayerId) : ''))

function startPlaying(): void {
  sound.prime() // a tap: unlocks audio so the timer can beep later (iOS)
  app.dispatch({ type: 'startPlaying', now: Date.now() })
}
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="starting">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round.number }) }}</Chip>
      <ImposterCountChip />
      <LeaveRoundButton />
    </template>
    <StickerCard motion="wobble">
      <span class="title-xl" data-testid="starter">{{ app.t('discussion.starts', { name: starter }) }}</span>
    </StickerCard>
    <p class="guide">{{ app.t('discussion.guide', { name: starter }) }}</p>
    <template #actions>
      <PopButton attention data-testid="start-playing" @click="startPlaying">{{ app.t('discussion.startPlaying') }}</PopButton>
    </template>
  </Screen>
</template>
