import { computed, ref, watch } from "vue"

export type ThemePreference = "light" | "dark" | "system"

const THEME_STORAGE_KEY = "whaler.theme-preference"

export const themePreference = ref<ThemePreference>("system")
export const systemPrefersDark = ref(false)

export const effectiveThemeName = computed(() => {
  if (themePreference.value === "system") return systemPrefersDark.value ? "whalerDark" : "whalerLight"
  return themePreference.value === "dark" ? "whalerDark" : "whalerLight"
})

export const effectiveThemeLabel = computed(() => {
  if (themePreference.value === "system") return systemPrefersDark.value ? "System dark" : "System light"
  return themePreference.value === "dark" ? "Dark" : "Light"
})

let removeMediaListener: (() => void) | null = null

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

export function applyDocumentTheme(themeName: string) {
  if (typeof document === "undefined") return
  const mode = themeName === "whalerDark" ? "dark" : "light"
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

export function initializeThemePreference() {
  if (typeof window === "undefined") return

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (isThemePreference(stored)) themePreference.value = stored

  const media = window.matchMedia("(prefers-color-scheme: dark)")
  systemPrefersDark.value = media.matches

  const onChange = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches
  }
  media.addEventListener("change", onChange)
  removeMediaListener = () => media.removeEventListener("change", onChange)
}

export function teardownTheme() {
  removeMediaListener?.()
  removeMediaListener = null
}

watch(themePreference, (value) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_STORAGE_KEY, value)
})
