import { computed, onUnmounted, ref, type ComputedRef } from 'vue'

export interface TimerView {
  active: boolean
  secondsLeft: number
  ended: boolean
}

export function timerView(endsAt: number | null, now: number): TimerView {
  if (endsAt === null) return { active: false, secondsLeft: 0, ended: false }
  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return { active: true, secondsLeft, ended: secondsLeft === 0 }
}

/**
 * Ticks four times a second. Calls onEnd once when the countdown reaches zero while mounted —
 * not when the screen opens on an already-finished timer (e.g. after a reload).
 */
export function useTimer(endsAt: () => number | null, onEnd: () => void): ComputedRef<TimerView> {
  const now = ref(Date.now())
  const view = computed(() => timerView(endsAt(), now.value))
  let fired = view.value.ended
  const id = setInterval(() => {
    now.value = Date.now()
    if (!fired && view.value.ended) {
      fired = true
      onEnd()
    }
  }, 250)
  onUnmounted(() => clearInterval(id))
  return view
}
