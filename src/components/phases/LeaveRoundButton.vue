<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useApp } from '../../composables/useApp'

const app = useApp()
const router = useRouter()
</script>

<template>
  <!-- Goes Home through PlayView's "Leave the round?" guard; Home then offers "Abandon this round". -->
  <button
    type="button"
    class="icon-btn leave"
    :aria-label="app.t('play.leaveRound')"
    :title="app.t('play.leaveRound')"
    data-testid="leave-round"
    @click="router.push('/')"
  >
    ✕
  </button>
</template>

<style scoped>
.leave { margin-inline-start: auto; }
</style>
