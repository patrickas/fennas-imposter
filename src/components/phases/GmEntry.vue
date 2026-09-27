<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '../../composables/useApp'
import { categoriesNamedIn, type GmField, type GmWordError } from '../../data/content'
import { LIMITS } from '../../data/limits'
import Screen from '../ui/Screen.vue'
import StickerCard from '../ui/StickerCard.vue'
import PopButton from '../ui/PopButton.vue'
import Chip from '../ui/Chip.vue'
import LeaveRoundButton from './LeaveRoundButton.vue'

const NEW_CATEGORY = '__new__'

const app = useApp()
const round = computed(() => app.state.round)
const lang = computed(() => round.value?.lang ?? app.state.language)
const gmName = computed(() => {
  const source = round.value?.source
  return source?.kind === 'playerGm' ? app.playerName(source.gmPlayerId) : null
})
const categoryOptions = computed(() =>
  categoriesNamedIn(app.content.value, lang.value).map((c) => ({ id: c.id, name: c.name[lang.value] ?? '' })),
)

const ready = ref(false)
const word = ref('')
const hint = ref('')
const categoryId = ref(categoryOptions.value[0]?.id ?? NEW_CATEGORY)
const newCategory = ref('')
const errors = ref<GmWordError[]>([])

function errorFor(field: GmField): string | null {
  const error = errors.value.find((e) => e.field === field)
  if (!error) return null
  if (error.code === 'empty') return app.t('error.textEmpty')
  if (error.code === 'unknown') return app.t('error.unknownCategory')
  const max = field === 'category' ? LIMITS.category : field === 'hint' ? LIMITS.hint : LIMITS.word
  return app.t('error.tooLong', { max })
}

function submit(): void {
  errors.value = app.submitGmWord({
    lang: lang.value,
    word: word.value,
    hint: hint.value,
    category: categoryId.value === NEW_CATEGORY ? { newName: newCategory.value } : { existingId: categoryId.value },
  })
}
</script>

<template>
  <Screen v-if="!ready" tone="sun" data-testid="gm-pass">
    <template #top>
      <Chip>{{ app.t('play.round', { n: round?.number ?? 1 }) }}</Chip>
      <LeaveRoundButton />
    </template>
    <StickerCard motion="wobble">
      <p class="title">{{ gmName ? app.t('gm.passToPlayer', { name: gmName }) : app.t('gm.passTo') }}</p>
    </StickerCard>
    <p class="guide">{{ app.t('gm.guide') }}</p>
    <template #actions>
      <PopButton attention data-testid="gm-ready" @click="ready = true">{{ app.t('gm.imGm') }}</PopButton>
    </template>
  </Screen>

  <Screen v-else tone="sun" align="start" data-testid="gm-form">
    <template #top>
      <LeaveRoundButton />
    </template>
    <p class="guide">{{ app.t('gm.guide') }}</p>
    <form class="panel stack" @submit.prevent="submit">
      <label class="field">
        {{ app.t('gm.word') }}
        <input v-model="word" class="input" data-testid="gm-word" :lang="lang" autocomplete="off" autocapitalize="off" spellcheck="false">
        <span v-if="errorFor('word')" class="error-text">{{ errorFor('word') }}</span>
      </label>
      <label class="field">
        {{ app.t('gm.category') }}
        <select v-model="categoryId" class="input" data-testid="gm-category">
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          <option :value="NEW_CATEGORY">{{ app.t('gm.newCategory') }}</option>
        </select>
      </label>
      <label v-if="categoryId === NEW_CATEGORY" class="field">
        {{ app.t('gm.newCategoryName') }}
        <input v-model="newCategory" class="input" data-testid="gm-new-category" :lang="lang" autocomplete="off">
      </label>
      <span v-if="errorFor('category')" class="error-text">{{ errorFor('category') }}</span>
      <label class="field">
        {{ app.t('gm.hint') }}
        <input v-model="hint" class="input" data-testid="gm-hint" :lang="lang" autocomplete="off">
        <span v-if="errorFor('hint')" class="error-text">{{ errorFor('hint') }}</span>
      </label>
      <PopButton type="submit" data-testid="gm-submit">{{ app.t('gm.done') }}</PopButton>
    </form>
  </Screen>
</template>

<style scoped>
.title { font-size: 1.6rem; font-weight: 800; }
</style>
