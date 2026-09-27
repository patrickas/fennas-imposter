import { reactive } from 'vue'

export interface ConfirmOptions {
  message: string
  confirmLabel: string
  cancelLabel: string
  /** Style the confirm button as destructive (delete, end game, abandon). */
  danger?: boolean
}

interface DialogState extends Required<ConfirmOptions> {
  open: boolean
}

const state = reactive<DialogState>({ open: false, message: '', confirmLabel: '', cancelLabel: '', danger: false })
let settle: ((confirmed: boolean) => void) | null = null

/**
 * The app's own confirmation dialog (never the browser's alert/confirm/prompt). Resolves true on
 * confirm, false on cancel, Escape or a tap outside. A newer question cancels an unanswered one.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  settle?.(false)
  Object.assign(state, { danger: false, ...options, open: true })
  return new Promise((resolve) => {
    settle = resolve
  })
}

export function answerDialog(confirmed: boolean): void {
  const resolve = settle
  settle = null
  state.open = false
  resolve?.(confirmed)
}

export function useDialogState(): Readonly<DialogState> {
  return state
}
