import { useRegisterSW } from 'virtual:pwa-register/vue'

type Registration = ReturnType<typeof useRegisterSW>
let registration: Registration | null = null

/** Registers the service worker once per page load. App.vue calls it at startup so offline caching never depends on the route. */
export function usePwaUpdate(): Registration {
  registration ??= useRegisterSW({ immediate: true })
  return registration
}
