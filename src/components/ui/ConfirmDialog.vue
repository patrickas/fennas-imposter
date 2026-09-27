<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { answerDialog, useDialogState } from '../../composables/useDialog'
import PopButton from './PopButton.vue'

const dialog = useDialogState()
const cancelButton = ref<InstanceType<typeof PopButton> | null>(null)

// Same double-tap guard as screens: the tap that opened the dialog must not also answer it.
const ARM_DELAY_MS = 500
const armed = ref(false)
let armTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => dialog.open,
  (open) => {
    armed.value = false
    clearTimeout(armTimer)
    if (!open) return
    armTimer = setTimeout(async () => {
      armed.value = true
      await nextTick()
      ;(cancelButton.value?.$el as HTMLElement | undefined)?.focus() // safe default for keyboards
    }, ARM_DELAY_MS)
  },
)

function onKeydown(event: KeyboardEvent): void {
  if (dialog.open && event.key === 'Escape') answerDialog(false)
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(armTimer)
})
</script>

<template>
  <Transition name="pop">
    <div v-if="dialog.open" class="backdrop" @click.self="answerDialog(false)">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-message" data-testid="dialog">
        <p id="dialog-message" class="message">{{ dialog.message }}</p>
        <div class="buttons" :inert="!armed">
          <PopButton ref="cancelButton" variant="secondary" data-testid="dialog-cancel" @click="answerDialog(false)">
            {{ dialog.cancelLabel }}
          </PopButton>
          <PopButton :variant="dialog.danger ? 'danger' : 'primary'" data-testid="dialog-confirm" @click="answerDialog(true)">
            {{ dialog.confirmLabel }}
          </PopButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: rgb(27 16 54 / 0.6); }
.dialog {
  display: flex; flex-direction: column; gap: 18px; width: min(100%, 420px); padding: 22px 18px;
  border: var(--outline); border-radius: var(--radius-lg); background: var(--paper); box-shadow: var(--shadow-hard);
}
.message { font-size: 1.2rem; font-weight: 700; text-align: center; overflow-wrap: anywhere; }
.buttons { display: flex; gap: 10px; }
</style>
