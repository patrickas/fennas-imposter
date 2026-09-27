<script setup lang="ts">
import { computed } from 'vue'
import { useApp } from '../../composables/useApp'
import Screen from '../ui/Screen.vue'
import PopButton from '../ui/PopButton.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const app = useApp()
const round = computed(() => app.state.round)
</script>

<template>
  <Screen v-if="round" tone="sun" data-testid="vote">
    <template #top>
      <LeaveRoundButton />
    </template>
    <h2 class="center">{{ app.t('vote.title') }}</h2>
    <div class="grid">
      <PopButton
        v-for="id in round.participantIds"
        :key="id"
        variant="secondary"
        data-testid="vote-player"
        @click="app.dispatch({ type: 'voteOut', playerId: id })"
      >
        {{ app.playerName(id) }}
      </PopButton>
    </div>
    <template #actions>
      <PopButton variant="danger" data-testid="vote-nobody" @click="app.dispatch({ type: 'voteOut', playerId: null })">
        {{ app.t('vote.nobody') }}
      </PopButton>
    </template>
  </Screen>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
</style>
