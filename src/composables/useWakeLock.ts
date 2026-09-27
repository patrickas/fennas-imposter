import { onUnmounted, watch, type Ref } from 'vue'

/** Keeps the screen on while `active` is true. Silently does nothing where unsupported. */
export function useWakeLock(active: Ref<boolean>): void {
  let sentinel: WakeLockSentinel | null = null

  async function acquire(): Promise<void> {
    if (!('wakeLock' in navigator) || sentinel || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  async function release(): Promise<void> {
    const current = sentinel
    sentinel = null
    try {
      await current?.release()
    } catch {
      // already released by the browser
    }
  }

  // Browsers drop the lock when the tab is hidden; take it back when the phone is unlocked.
  function onVisibilityChange(): void {
    if (active.value && document.visibilityState === 'visible') void acquire()
  }

  watch(active, (on) => void (on ? acquire() : release()), { immediate: true })
  document.addEventListener('visibilitychange', onVisibilityChange)
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void release()
  })
}
