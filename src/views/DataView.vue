<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '../composables/useApp'
import {
  exportFileName, exportPack, fetchPackJson, readPackFile,
  type FetchResult, type ImportMode, type ImportPlan, type PackError,
} from '../data/transfer'
import { isolate } from '../i18n'
import Screen from '../components/ui/Screen.vue'
import PopButton from '../components/ui/PopButton.vue'

const app = useApp()
const router = useRouter()

const url = ref(app.state.lastImportUrl ?? '')
const busy = ref(false)
const problem = ref<string | null>(null)
const packErrors = ref<PackError[]>([])
const plan = ref<ImportPlan | null>(null)
const imported = ref(false)

function reset(): void {
  problem.value = null
  packErrors.value = []
  plan.value = null
  imported.value = false
}

function exportBackup(): void {
  const blob = new Blob([exportPack(app.state)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = exportFileName(new Date())
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
}

function fetchErrorText(result: Extract<FetchResult, { ok: false }>): string {
  if (result.error === 'httpStatus') return app.t('fetch.httpStatus', { status: result.status ?? 0 })
  return app.t(`fetch.${result.error}`)
}

function preview(json: unknown, mode: ImportMode): void {
  const result = app.previewImport(json, mode)
  if (result.ok) plan.value = result.plan
  else packErrors.value = result.errors
}

async function onFile(event: Event): Promise<void> {
  reset()
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const result = await readPackFile(file)
  if (result.ok) preview(result.json, 'file')
  else problem.value = fetchErrorText(result)
}

async function onUrl(): Promise<void> {
  reset()
  busy.value = true
  try {
    app.setLastImportUrl(url.value)
    const result = await fetchPackJson(url.value)
    if (result.ok) preview(result.json, 'url')
    else problem.value = fetchErrorText(result)
  } finally {
    busy.value = false
  }
}

function confirmImport(): void {
  if (!plan.value) return
  app.applyImport(plan.value)
  plan.value = null
  imported.value = true
}

const summary = computed(() => {
  const s = plan.value?.summary
  if (!s) return []
  const lines: string[] = []
  if (s.addCategories) lines.push(app.t('data.addsCategories', { count: s.addCategories }))
  if (s.updateCategories) lines.push(app.t('data.updatesCategories', { count: s.updateCategories }))
  if (s.addWords) lines.push(app.t('data.addsWords', { count: s.addWords }))
  if (s.updateWords) lines.push(app.t('data.updatesWords', { count: s.updateWords }))
  if (s.addPlayers) lines.push(app.t('data.addsPlayers', { count: s.addPlayers }))
  if (s.replacesSettings) lines.push(app.t('data.replacesSettings'))
  if (s.skippedBuiltIn) lines.push(app.t('data.skipsBuiltIn', { count: s.skippedBuiltIn }))
  return lines
})
const hasChanges = computed(() => {
  const s = plan.value?.summary
  if (!s) return false
  return s.addCategories + s.updateCategories + s.addWords + s.updateWords + s.addPlayers > 0 || s.replacesSettings
})
const overwrites = computed(() => {
  const s = plan.value?.summary
  return !!s && s.updateCategories + s.updateWords > 0
})
</script>

<template>
  <Screen tone="sun" align="start">
    <template #top>
      <h1>{{ app.t('data.title') }}</h1>
      <button type="button" class="icon-btn" data-testid="back" @click="router.push('/')">{{ app.t('common.back') }}</button>
    </template>

    <p class="guide">{{ app.t('data.backupTip') }}</p>

    <section class="panel stack">
      <PopButton data-testid="export" @click="exportBackup">{{ app.t('data.export') }}</PopButton>
      <label class="field">
        {{ app.t('data.importFile') }}
        <input type="file" accept="application/json,.json" class="input" data-testid="import-file" @change="onFile">
      </label>
      <form class="stack" @submit.prevent="onUrl">
        <label class="field">
          {{ app.t('data.importUrl') }}
          <input
            v-model="url"
            type="text"
            inputmode="url"
            dir="ltr"
            class="input"
            autocomplete="off"
            :placeholder="app.t('data.urlPlaceholder')"
            data-testid="import-url"
          >
        </label>
        <PopButton type="submit" variant="secondary" :disabled="busy || !url.trim()" data-testid="import-url-load">
          {{ app.t('data.load') }}
        </PopButton>
      </form>
    </section>

    <p v-if="problem" class="panel error-text" role="alert" data-testid="import-problem">{{ problem }}</p>

    <section v-if="packErrors.length" class="panel" role="alert" data-testid="import-errors">
      <p class="error-text">{{ app.t('data.problems') }}</p>
      <ul>
        <li v-for="(e, i) in packErrors" :key="i">{{ e.path ? `${isolate(e.path)}: ` : '' }}{{ app.t(`pack.${e.code}`) }}</li>
      </ul>
    </section>

    <section v-if="plan" class="panel stack" data-testid="import-summary">
      <ul>
        <li v-for="line in summary" :key="line">{{ line }}</li>
      </ul>
      <p v-if="!hasChanges">{{ app.t('data.nothing') }}</p>
      <p v-if="overwrites" class="error-text">{{ app.t('data.overwriteNote') }}</p>
      <div class="row">
        <PopButton v-if="hasChanges" data-testid="import-confirm" @click="confirmImport">{{ app.t('data.confirm') }}</PopButton>
        <PopButton variant="secondary" @click="reset">{{ app.t('common.cancel') }}</PopButton>
      </div>
    </section>

    <p v-if="imported" class="guide" role="status" data-testid="import-done">{{ app.t('data.imported') }}</p>
  </Screen>
</template>

<style scoped>
h1 { font-size: 1.8rem; }
ul { margin: 0; padding-inline-start: 20px; }
</style>
