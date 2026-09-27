<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Category, Lang, Localized, Word } from '../engine/types'
import { useApp } from '../composables/useApp'
import type { LocalizedError } from '../data/content'
import { LIMITS } from '../data/limits'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'
import Chip from '../components/ui/Chip.vue'

type Draft = Record<Lang, string>
type Editing =
  | { kind: 'word'; id: string; text: Draft; hint: Draft }
  | { kind: 'category'; id: string; name: Draft }

const app = useApp()
const router = useRouter()
const editing = ref<Editing | null>(null)
const editErrors = ref<LocalizedError[]>([])

const otherLang = computed<Lang>(() => (app.state.language === 'en' ? 'ar' : 'en'))
/** Management screen, not a round: fall back to the other language so every entry is visible. */
function show(value: Localized): string {
  return value[app.state.language] ?? value[otherLang.value] ?? ''
}
const draft = (value: Localized): Draft => ({ en: value.en ?? '', ar: value.ar ?? '' })

const groups = computed(() => {
  const customIds = new Set(app.state.customCategories.map((c) => c.id))
  const withCustomWords = new Set(app.state.customWords.map((w) => w.categoryId))
  return app.content.value.categories
    .filter((c) => customIds.has(c.id) || withCustomWords.has(c.id))
    .map((category) => ({
      category,
      isCustom: customIds.has(category.id),
      words: app.state.customWords.filter((w) => w.categoryId === category.id),
    }))
})

function editWord(word: Word): void {
  editing.value = { kind: 'word', id: word.id, text: draft(word.text), hint: draft(word.hint) }
  editErrors.value = []
}

function editCategory(category: Category): void {
  editing.value = { kind: 'category', id: category.id, name: draft(category.name) }
  editErrors.value = []
}

function save(): void {
  const e = editing.value
  if (!e) return
  editErrors.value = e.kind === 'word' ? app.updateCustomWord(e.id, e.text, e.hint) : app.updateCustomCategory(e.id, e.name)
  if (editErrors.value.length === 0) editing.value = null
}

function errorText(error: LocalizedError): string {
  if (error.code === 'needOneLanguage') return app.t('error.needOneLanguage')
  const max = error.field === 'name' ? LIMITS.category : error.field === 'hint' ? LIMITS.hint : LIMITS.word
  return app.t('error.tooLong', { max })
}

function removeWord(id: string): void {
  if (window.confirm(app.t('words.deleteWordConfirm'))) app.deleteCustomWord(id)
}

function removeCategory(id: string, count: number): void {
  if (window.confirm(app.t('words.deleteCategoryConfirm', { count }))) app.deleteCustomCategory(id)
}
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('words.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <p v-if="groups.length === 0" class="guide" data-testid="words-empty">{{ app.t('words.empty') }}</p>

    <section v-for="group in groups" :key="group.category.id" class="panel stack" data-testid="custom-category">
      <div class="row">
        <h2 class="grow" dir="auto">{{ show(group.category.name) }}</h2>
        <Chip v-if="!group.isCustom">{{ app.t('words.builtIn') }}</Chip>
        <template v-else>
          <button type="button" class="icon-btn" @click="editCategory(group.category)">{{ app.t('common.edit') }}</button>
          <button type="button" class="icon-btn" @click="removeCategory(group.category.id, group.words.length)">{{ app.t('common.delete') }}</button>
        </template>
      </div>

      <form v-if="editing?.kind === 'category' && editing.id === group.category.id" class="stack" @submit.prevent="save">
        <label class="field">{{ app.t('words.name') }} · {{ app.t('words.english') }}
          <input v-model="editing.name.en" class="input" lang="en" dir="ltr">
        </label>
        <label class="field">{{ app.t('words.name') }} · {{ app.t('words.arabic') }}
          <input v-model="editing.name.ar" class="input" lang="ar" dir="rtl">
        </label>
        <p v-for="(e, i) in editErrors" :key="i" class="error-text">{{ errorText(e) }}</p>
        <div class="row">
          <PopButton type="submit">{{ app.t('common.save') }}</PopButton>
          <PopButton variant="secondary" @click="editing = null">{{ app.t('common.cancel') }}</PopButton>
        </div>
      </form>

      <ul class="words">
        <li v-for="word in group.words" :key="word.id" data-testid="custom-word">
          <form v-if="editing?.kind === 'word' && editing.id === word.id" class="stack" @submit.prevent="save">
            <label class="field">{{ app.t('words.word') }} · {{ app.t('words.english') }}
              <input v-model="editing.text.en" class="input" lang="en" dir="ltr">
            </label>
            <label class="field">{{ app.t('words.word') }} · {{ app.t('words.arabic') }}
              <input v-model="editing.text.ar" class="input" lang="ar" dir="rtl">
            </label>
            <label class="field">{{ app.t('words.hint') }} · {{ app.t('words.english') }}
              <input v-model="editing.hint.en" class="input" lang="en" dir="ltr">
            </label>
            <label class="field">{{ app.t('words.hint') }} · {{ app.t('words.arabic') }}
              <input v-model="editing.hint.ar" class="input" lang="ar" dir="rtl">
            </label>
            <p v-for="(e, i) in editErrors" :key="i" class="error-text">{{ errorText(e) }}</p>
            <div class="row">
              <PopButton type="submit">{{ app.t('common.save') }}</PopButton>
              <PopButton variant="secondary" @click="editing = null">{{ app.t('common.cancel') }}</PopButton>
            </div>
          </form>
          <div v-else class="row">
            <span class="grow word" dir="auto">{{ show(word.text) }}</span>
            <button type="button" class="icon-btn" @click="editWord(word)">{{ app.t('common.edit') }}</button>
            <button type="button" class="icon-btn" @click="removeWord(word.id)">{{ app.t('common.delete') }}</button>
          </div>
        </li>
      </ul>
    </section>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
h2 { overflow-wrap: anywhere; }
.words { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.word { font-weight: 700; overflow-wrap: anywhere; }
</style>
