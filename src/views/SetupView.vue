<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp, type RosterError } from '../composables/useApp'
import { eligibleCategories, eligibleWords } from '../engine/words'
import { maxImposters } from '../engine/assign'
import { LIMITS, TIMER } from '../data/limits'
import { formatClock } from '../i18n'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'
import UpdatePrompt from '../components/ui/UpdatePrompt.vue'
import Toggle from '../components/ui/Toggle.vue'
import Stepper from '../components/ui/Stepper.vue'
import LanguageSwitch from '../components/ui/LanguageSwitch.vue'

const app = useApp()
const router = useRouter()

const newName = ref('')
const addError = ref<string | null>(null)
const rowError = ref<{ id: string; message: string } | null>(null)

function errorText(error: RosterError): string {
  switch (error) {
    case 'empty':
      return app.t('error.nameEmpty')
    case 'tooLong':
      return app.t('error.nameTooLong', { max: LIMITS.player })
    case 'taken':
      return app.t('error.nameTaken')
    case 'inRound':
      return app.t('error.inRound')
  }
}

function add(): void {
  const error = app.addPlayer(newName.value)
  addError.value = error ? errorText(error) : null
  if (!error) newName.value = ''
}

function rename(id: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const error = app.renamePlayer(id, input.value)
  rowError.value = error ? { id, message: errorText(error) } : null
  if (error) input.value = app.playerName(id)
}

function remove(id: string): void {
  const error = app.removePlayer(id)
  rowError.value = error ? { id, message: errorText(error) } : null
}

function toggleActive(id: string, event: Event): void {
  app.setActive(id, (event.target as HTMLInputElement).checked)
}

const categories = computed(() => {
  const lang = app.state.language
  return eligibleCategories(app.content.value, lang).map((c) => ({
    id: c.id,
    name: c.name[lang] ?? '',
    count: eligibleWords(app.content.value, lang, [c.id]).length,
  }))
})
const noneSelected = computed(() => !categories.value.some((c) => app.state.selectedCategoryIds.includes(c.id)))

const imposterMax = computed(() => Math.max(1, maxImposters(app.state.activePlayerIds.length)))
const imposters = computed({
  get: () => Math.min(app.state.settings.imposterCount, imposterMax.value),
  set: (imposterCount: number) => app.updateSettings({ imposterCount }),
})
const randomImposters = computed({
  get: () => app.state.settings.randomImposterCount,
  set: (randomImposterCount: boolean) => app.updateSettings({ randomImposterCount }),
})
const hints = computed({
  get: () => app.state.settings.hints,
  set: (value: boolean) => app.updateSettings({ hints: value }),
})
const scoring = computed({
  get: () => app.state.settings.scoring,
  set: (value: boolean) => app.updateSettings({ scoring: value }),
})
const timerEnabled = computed({
  get: () => app.state.settings.timer.enabled,
  set: (enabled: boolean) => app.updateSettings({ timer: { ...app.state.settings.timer, enabled } }),
})
const timerSeconds = computed({
  get: () => app.state.settings.timer.seconds,
  set: (seconds: number) => app.updateSettings({ timer: { ...app.state.settings.timer, seconds } }),
})

function done(): void {
  void router.push(app.state.session ? '/play' : '/')
}
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('setup.title') }}</h1>
      <LanguageSwitch />
    </template>

    <UpdatePrompt />
    <section class="panel stack">
      <h2>{{ app.t('setup.players') }}</h2>
      <p>{{ app.t('setup.activeCount', { count: app.state.activePlayerIds.length }) }}</p>
      <ul class="players">
        <li v-for="player in app.state.players" :key="player.id" data-testid="player-row">
          <div class="row">
            <label class="check">
              <input
                type="checkbox"
                :checked="app.state.activePlayerIds.includes(player.id)"
                :aria-label="app.t('setup.playing')"
                @change="toggleActive(player.id, $event)"
              >
            </label>
            <input class="input grow" :value="player.name" autocomplete="off" @change="rename(player.id, $event)">
            <button
              type="button"
              class="icon-btn"
              :aria-label="app.t('setup.removePlayer', { name: player.name })"
              @click="remove(player.id)"
            >
              ✕
            </button>
          </div>
          <p v-if="rowError?.id === player.id" class="error-text">{{ rowError.message }}</p>
        </li>
      </ul>
      <form class="row" @submit.prevent="add">
        <input
          v-model="newName"
          class="input grow"
          data-testid="new-player"
          :placeholder="app.t('setup.newPlayerPlaceholder')"
          autocomplete="off"
        >
        <button type="submit" class="icon-btn" data-testid="add-player">{{ app.t('setup.addPlayer') }}</button>
      </form>
      <p v-if="addError" class="error-text" data-testid="add-error">{{ addError }}</p>
    </section>

    <section class="panel stack">
      <h2>{{ app.t('setup.categories') }}</h2>
      <label v-for="c in categories" :key="c.id" class="category">
        <input
          type="checkbox"
          :checked="app.state.selectedCategoryIds.includes(c.id)"
          :data-testid="`category-${c.id}`"
          @change="app.toggleCategory(c.id)"
        >
        <span class="grow">{{ c.name }}</span>
        <span class="count">{{ app.t('setup.wordCount', { count: c.count }) }}</span>
      </label>
      <p v-if="noneSelected" class="error-text">{{ app.t('error.noCategories') }}</p>
    </section>

    <section class="panel stack">
      <h2>{{ app.t('setup.settings') }}</h2>
      <Stepper
        v-model="imposters"
        :min="1"
        :max="imposterMax"
        :label="app.t('setup.imposters')"
        :decrease-label="app.t('setup.decrease')"
        :increase-label="app.t('setup.increase')"
        :disabled="randomImposters"
        testid="imposters"
      />
      <Toggle v-model="randomImposters" :label="app.t('setup.randomImposters')" testid="toggle-random-imposters" />
      <Toggle v-model="hints" :label="app.t('setup.hints')" testid="toggle-hints" />
      <Toggle v-model="timerEnabled" :label="app.t('setup.timer')" testid="toggle-timer" />
      <Stepper
        v-if="timerEnabled"
        v-model="timerSeconds"
        :min="TIMER.min"
        :max="TIMER.max"
        :step="TIMER.step"
        :display="formatClock(timerSeconds)"
        :label="app.t('setup.timerLength')"
        :decrease-label="app.t('setup.decrease')"
        :increase-label="app.t('setup.increase')"
        testid="timer-seconds"
      />
      <Toggle v-model="scoring" :label="app.t('setup.scoring')" testid="toggle-scoring" />
    </section>

    <template #actions>
      <PopButton data-testid="setup-done" @click="done">{{ app.t('setup.done') }}</PopButton>
    </template>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
.players { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.check { display: flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); }
.check input, .category input { width: 24px; height: 24px; accent-color: var(--grape); }
.category { display: flex; align-items: center; gap: 12px; min-height: var(--tap); font-weight: 700; }
.category .grow { overflow-wrap: anywhere; }
.count { font-weight: 500; opacity: 0.75; white-space: nowrap; }
</style>
