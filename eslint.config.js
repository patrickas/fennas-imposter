import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'public/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  { rules: { 'vue/multi-word-component-names': 'off' } },
)
