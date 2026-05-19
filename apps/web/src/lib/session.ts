import type { Session } from "@supabase/supabase-js"
import { computed, ref, watch } from "vue"
import { type AwarenessUser, colorFromUserId } from "@whaler/shared"
import { apiClient } from "@/lib/api"
import { supabase } from "@/lib/supabase"

export type Profile = {
  id: string
  email: string | null
  displayName: string | null
  color: string
  avatarUrl: string | null
}

const session = ref<Session | null>(null)
const profile = ref<Profile | null>(null)
const authReady = ref(false)
const authNotice = ref<string | null>(null)
const passwordRecovery = ref(false)
let initialized = false
let removeAuthListener: (() => void) | null = null
let clearingInvalidSession = false

const accessToken = computed(() => session.value?.access_token ?? "")

const currentUser = computed<AwarenessUser>(() => {
  const user = session.value?.user
  const id = user?.id ?? "anonymous"
  const email = user?.email ?? undefined
  const profileRow = profile.value
  const awarenessUser: AwarenessUser = {
    id,
    name: profileRow?.displayName ?? email?.split("@")[0] ?? "User",
    color: profileRow?.color ?? colorFromUserId(id)
  }
  if (email) awarenessUser.email = email
  if (profileRow?.avatarUrl) awarenessUser.avatarUrl = profileRow.avatarUrl
  return awarenessUser
})

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

async function resolveInitialSession(): Promise<Session | null> {
  try {
    const result = await withTimeout(supabase.auth.getSession(), 2500)
    return result.data.session
  } catch {
    authNotice.value = "Could not restore your previous session. Please sign in again."
    return null
  }
}

async function clearInvalidSession() {
  if (clearingInvalidSession) return
  clearingInvalidSession = true
  authNotice.value = "Your session expired. Please sign in again."
  session.value = null
  try {
    await withTimeout(supabase.auth.signOut(), 2500)
  } catch {
    // already cleared local state
  } finally {
    clearingInvalidSession = false
  }
}

export async function handleUnauthorizedResponse(response: Response): Promise<boolean> {
  if (response.status !== 401) return false
  await clearInvalidSession()
  return true
}

export function client() {
  if (!accessToken.value) throw new Error("Missing session")
  return apiClient(accessToken.value)
}

async function fetchProfile() {
  if (!accessToken.value) {
    profile.value = null
    return
  }
  try {
    const response = await apiClient(accessToken.value).v1.me.$get()
    if (!response.ok) {
      profile.value = null
      return
    }
    const payload = (await response.json()) as { profile: Profile | null }
    profile.value = payload.profile
  } catch {
    profile.value = null
  }
}

export async function refreshProfile() {
  await fetchProfile()
}

export async function updateProfile(input: { avatarUrl?: string | null; displayName?: string }) {
  if (!accessToken.value) return
  const response = await apiClient(accessToken.value).v1.me.profile.$patch({ json: input })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const payload = (await response.json()) as { profile: Profile }
  profile.value = payload.profile
}

export async function initSession() {
  if (initialized) return
  initialized = true

  const listener = supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "INITIAL_SESSION") return
    passwordRecovery.value = event === "PASSWORD_RECOVERY"
    session.value = nextSession
    if (nextSession) authNotice.value = null
    else profile.value = null
  })
  removeAuthListener = () => listener.data.subscription.unsubscribe()

  session.value = await resolveInitialSession()
  if (session.value) await fetchProfile()
  authReady.value = true
}

watch(session, async (next, prev) => {
  if (next && next.user?.id !== prev?.user?.id) {
    await fetchProfile()
  }
})

export function teardownSession() {
  removeAuthListener?.()
  removeAuthListener = null
  initialized = false
}

export async function signOut() {
  authNotice.value = null
  passwordRecovery.value = false
  await supabase.auth.signOut()
}

export function finishPasswordRecovery() {
  passwordRecovery.value = false
}

export function useSession() {
  return { session, profile, authReady, authNotice, passwordRecovery, accessToken, currentUser }
}
