<script setup lang="ts">
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import { useDisplay, useTheme } from "vuetify"
import { colorFromUserId, type AwarenessUser, type FileLocation, type SandboxImage } from "@whaler/shared"
import AuthView from "@/components/AuthView.vue"
import CodeEditor from "@/components/CodeEditor.vue"
import FileTree from "@/components/FileTree.vue"
import { apiClient } from "@/lib/api"
import { collabUrl } from "@/lib/config"
import { supabase } from "@/lib/supabase"

type Workspace = {
  id: string
  name: string
  imageId: string
  imageRef: string
  containerStatus: "pending" | "starting" | "running" | "stopped" | "error"
}

type WorkspaceFile = {
  id: string
  workspaceId: string
  path: string
  kind: "file" | "directory"
  language: string | null
}

type PresenceEntry = {
  user: AwarenessUser
  location?: FileLocation
}

type AppPage = "workspace" | "settings"
type ThemePreference = "light" | "dark" | "system"

const THEME_STORAGE_KEY = "whaler.theme-preference"

const session = ref<Session | null>(null)
const authReady = ref(false)
const authNotice = ref<string | null>(null)
const images = ref<SandboxImage[]>([])
const workspaces = ref<Workspace[]>([])
const selectedWorkspaceId = ref<string | null>(null)
const files = ref<WorkspaceFile[]>([])
const activeFile = ref<WorkspaceFile | null>(null)
const creatingWorkspace = ref(false)
const newWorkspaceName = ref("Untitled workspace")
const selectedImageId = ref<string | null>(null)
const newPath = ref("src/new-file.ts")
const creatingFile = ref(false)
const error = ref<string | null>(null)
const presence = ref<PresenceEntry[]>([])
const activePage = ref<AppPage>("workspace")
const themePreference = ref<ThemePreference>("system")
const systemPrefersDark = ref(false)

let presenceProvider: HocuspocusProvider | null = null
let presenceDoc: Y.Doc | null = null
let removeThemeMediaListener: (() => void) | null = null
let removeAuthListener: (() => void) | null = null
let loadingWorkspaceData = false
let clearingInvalidSession = false

const theme = useTheme()
const { mdAndUp } = useDisplay()
const accessToken = computed(() => session.value?.access_token ?? "")
const selectedWorkspace = computed(() => workspaces.value.find((item) => item.id === selectedWorkspaceId.value) ?? null)
const selectedWorkspaceStatusIcon = computed(() => {
  switch (selectedWorkspace.value?.containerStatus) {
    case "running":
      return "mdi-check-circle-outline"
    case "starting":
    case "pending":
      return "mdi-progress-clock"
    case "stopped":
      return "mdi-stop-circle-outline"
    case "error":
      return "mdi-alert-circle-outline"
    default:
      return "mdi-circle-outline"
  }
})
const currentUser = computed<AwarenessUser>(() => {
  const user = session.value?.user
  const id = user?.id ?? "anonymous"
  const email = user?.email ?? undefined
  const awarenessUser: AwarenessUser = {
    id,
    name: email?.split("@")[0] ?? "User",
    color: colorFromUserId(id)
  }

  if (email) awarenessUser.email = email

  return awarenessUser
})
const effectiveThemeName = computed(() => {
  if (themePreference.value === "system") return systemPrefersDark.value ? "whalerDark" : "whalerLight"
  return themePreference.value === "dark" ? "whalerDark" : "whalerLight"
})
const effectiveThemeLabel = computed(() => {
  if (themePreference.value === "system") return systemPrefersDark.value ? "System dark" : "System light"
  return themePreference.value === "dark" ? "Dark" : "Light"
})
const activePageTitle = computed(() => (activePage.value === "settings" ? "Settings" : selectedWorkspace.value?.name ?? "Workspace"))
const activePageIcon = computed(() => (activePage.value === "settings" ? "mdi-cog-outline" : "mdi-file-code-outline"))
const themeOptions = [
  {
    value: "light",
    icon: "mdi-white-balance-sunny",
    title: "Light"
  },
  {
    value: "dark",
    icon: "mdi-weather-night",
    title: "Dark"
  },
  {
    value: "system",
    icon: "mdi-theme-light-dark",
    title: "System"
  }
] satisfies Array<{ value: ThemePreference; icon: string; title: string }>

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

function applyDocumentTheme(themeName: string) {
  if (typeof document === "undefined") return
  const mode = themeName === "whalerDark" ? "dark" : "light"
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

function initializeThemePreference() {
  if (typeof window === "undefined") return

  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (isThemePreference(storedPreference)) {
    themePreference.value = storedPreference
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)")
  systemPrefersDark.value = media.matches

  const handleSystemThemeChange = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches
  }

  media.addEventListener("change", handleSystemThemeChange)
  removeThemeMediaListener = () => media.removeEventListener("change", handleSystemThemeChange)
}

function client() {
  if (!accessToken.value) throw new Error("Missing session")
  return apiClient(accessToken.value)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Operation timed out"))
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

function clearWorkspaceState() {
  images.value = []
  workspaces.value = []
  selectedWorkspaceId.value = null
  selectedImageId.value = null
  files.value = []
  activeFile.value = null
  presence.value = []
}

async function clearInvalidSession() {
  if (clearingInvalidSession) return
  clearingInvalidSession = true
  authNotice.value = "Your session expired. Please sign in again."
  error.value = null
  session.value = null
  clearWorkspaceState()
  disposePresence()
  try {
    await withTimeout(supabase.auth.signOut(), 2500)
  } catch {
    // Local state is already cleared; a slow auth endpoint must not keep the app locked.
  } finally {
    clearingInvalidSession = false
  }
}

async function handleUnauthorizedResponse(response: Response): Promise<boolean> {
  if (response.status !== 401) return false
  await clearInvalidSession()
  return true
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

async function loadAuthenticatedData() {
  if (!session.value) return
  loadingWorkspaceData = true

  try {
    await loadInitialData()
    await loadFiles()
    connectPresence()
  } catch {
    error.value = "Failed to load workspace data"
  } finally {
    loadingWorkspaceData = false
  }
}

async function loadInitialData() {
  if (!session.value) return
  error.value = null
  const api = client()

  const meResponse = await api.v1.me.$get()
  if (!meResponse.ok) {
    if (await handleUnauthorizedResponse(meResponse)) return
    error.value = "Failed to validate session"
    return
  }

  const [imagesResponse, workspacesResponse] = await Promise.all([
    api.v1.images.$get(),
    api.v1.workspaces.$get()
  ])

  if (!imagesResponse.ok || !workspacesResponse.ok) {
    if (await handleUnauthorizedResponse(imagesResponse)) return
    if (await handleUnauthorizedResponse(workspacesResponse)) return
    error.value = "Failed to load workspace data"
    return
  }

  images.value = Array.from((await imagesResponse.json()).images, (image) => ({
    ...image,
    languages: [...image.languages]
  }))
  workspaces.value = (await workspacesResponse.json()).workspaces as Workspace[]
  selectedImageId.value = images.value[0]?.id ?? null
  selectedWorkspaceId.value = selectedWorkspaceId.value ?? workspaces.value[0]?.id ?? null
}

async function loadFiles() {
  if (!selectedWorkspaceId.value || !session.value) {
    files.value = []
    activeFile.value = null
    return
  }

  const response = await client().v1.workspaces[":workspaceId"].tree.$get({
    param: {
      workspaceId: selectedWorkspaceId.value
    }
  })

  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) return
    error.value = "Failed to load files"
    return
  }

  files.value = (await response.json()).files as WorkspaceFile[]
  activeFile.value = files.value.find((file) => file.kind === "file") ?? null
}

async function createWorkspace() {
  if (!selectedImageId.value) return
  creatingWorkspace.value = true
  error.value = null

  const response = await client().v1.workspaces.$post({
    json: {
      name: newWorkspaceName.value,
      imageId: selectedImageId.value
    }
  })

  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) {
      creatingWorkspace.value = false
      return
    }
    error.value = await response.text()
    creatingWorkspace.value = false
    return
  }

  const payload = (await response.json()) as { workspace: Workspace }
  workspaces.value.unshift(payload.workspace)
  selectedWorkspaceId.value = payload.workspace.id
  creatingWorkspace.value = false
}

async function createFile() {
  if (!selectedWorkspaceId.value) return
  creatingFile.value = true
  error.value = null

  const response = await client().v1.workspaces[":workspaceId"].files.$post({
    param: {
      workspaceId: selectedWorkspaceId.value
    },
    json: {
      path: newPath.value,
      kind: newPath.value.endsWith("/") ? "directory" : "file",
      content: ""
    }
  })

  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) {
      creatingFile.value = false
      return
    }
    error.value = await response.text()
    creatingFile.value = false
    return
  }

  const payload = (await response.json()) as { file: WorkspaceFile }
  files.value.push(payload.file)
  if (payload.file.kind === "file") activeFile.value = payload.file
  creatingFile.value = false
}

function disposePresence() {
  presenceProvider?.destroy()
  presenceDoc?.destroy()
  presenceProvider = null
  presenceDoc = null
  presence.value = []
}

function connectPresence() {
  disposePresence()
  if (!selectedWorkspaceId.value || !accessToken.value) return

  presenceDoc = new Y.Doc()
  presenceProvider = new HocuspocusProvider({
    url: collabUrl(),
    name: `workspace:${selectedWorkspaceId.value}:presence`,
    document: presenceDoc,
    token: accessToken.value
  })

  presenceProvider.setAwarenessField("user", currentUser.value)
  updatePresenceLocation()

  presenceProvider.on("awarenessUpdate", ({ states }: { states: Map<number, PresenceEntry> }) => {
    presence.value = Array.from(states.values()).filter((entry) => entry.user)
  })
}

function updatePresenceLocation() {
  if (!presenceProvider || !selectedWorkspaceId.value) return
  presenceProvider.setAwarenessField("location", {
    workspaceId: selectedWorkspaceId.value,
    fileId: activeFile.value?.id ?? null,
    path: activeFile.value?.path ?? null
  } satisfies FileLocation)
}

async function signOut() {
  authNotice.value = null
  await supabase.auth.signOut()
}

onMounted(async () => {
  try {
    initializeThemePreference()

    const authListener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (event === "INITIAL_SESSION") return
      session.value = nextSession
      if (nextSession) {
        authNotice.value = null
        void loadAuthenticatedData()
      } else {
        clearWorkspaceState()
        disposePresence()
      }
    })
    removeAuthListener = () => authListener.data.subscription.unsubscribe()

    session.value = await resolveInitialSession()
  } finally {
    authReady.value = true
  }

  if (session.value) {
    authNotice.value = null
    void loadAuthenticatedData()
  }
})

watch(selectedWorkspaceId, async () => {
  if (loadingWorkspaceData) return
  await loadFiles()
  connectPresence()
})

watch(activeFile, updatePresenceLocation)
watch(currentUser, () => presenceProvider?.setAwarenessField("user", currentUser.value))
watch(
  effectiveThemeName,
  (themeName) => {
    theme.change(themeName)
    applyDocumentTheme(themeName)
  },
  { immediate: true }
)
watch(themePreference, (preference) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
})

onBeforeUnmount(() => {
  disposePresence()
  removeThemeMediaListener?.()
  removeAuthListener?.()
})
</script>

<template>
  <main v-if="!authReady" class="boot-screen">
    <div class="boot-indicator">
      <div class="brand-mark">W</div>
      <span>Loading Whaler</span>
    </div>
  </main>
  <AuthView v-else-if="!session" :notice="authNotice" />
  <v-app v-else class="app-shell">
    <v-app-bar :height="mdAndUp ? 72 : 64" flat class="app-bar">
      <v-app-bar-title>
        <div class="app-bar-titleblock">
          <div class="brand-mark">W</div>
          <div class="app-title-copy">
            <span class="app-title-text">Whaler</span>
            <span class="app-page-title">
              <v-icon :icon="activePageIcon" size="16" />
              {{ activePageTitle }}
            </span>
          </div>
        </div>
      </v-app-bar-title>
      <v-spacer />
      <div class="app-bar-actions">
        <v-chip class="theme-chip" size="small" variant="tonal" prepend-icon="mdi-palette-outline">
          {{ effectiveThemeLabel }}
        </v-chip>
        <v-chip class="user-chip" size="small" variant="tonal" prepend-icon="mdi-account-circle">
          {{ currentUser.name }}
        </v-chip>
        <v-btn icon="mdi-logout" variant="text" title="Sign out" @click="signOut" />
      </div>
    </v-app-bar>

    <v-navigation-drawer :width="mdAndUp ? 88 : 72" permanent class="navigation-rail">
      <div class="nav-rail-content">
        <div class="nav-rail-items">
          <nav>
            <v-btn
              class="nav-rail-button"
              :class="{ 'nav-rail-button--active': activePage === 'workspace' }"
              icon="mdi-file-code-outline"
              variant="text"
              title="Workspace"
              @click="activePage = 'workspace'"
            />
          </nav>
          <nav>
            <v-btn
              class="nav-rail-button"
              :class="{ 'nav-rail-button--active': activePage === 'settings' }"
              icon="mdi-cog-outline"
              variant="text"
              title="Settings"
              @click="activePage = 'settings'"
            />
          </nav>
        </div>
      </div>
    </v-navigation-drawer>

    <v-navigation-drawer v-if="activePage === 'workspace' && mdAndUp" width="360" permanent class="material-drawer">
      <div class="sidebar-content">
        <div class="sidebar-section">
          <div class="sidebar-heading">
            <span class="sidebar-title">Workspace</span>
            <v-chip
              v-if="selectedWorkspace"
              class="status-chip"
              size="small"
              variant="flat"
              :prepend-icon="selectedWorkspaceStatusIcon"
              :data-status="selectedWorkspace.containerStatus"
            >
              {{ selectedWorkspace.containerStatus }}
            </v-chip>
          </div>
          <v-select
            v-model="selectedWorkspaceId"
            :items="workspaces"
            item-title="name"
            item-value="id"
            label="Workspace"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-view-dashboard-outline"
            hide-details
          />
        </div>

        <div class="sidebar-section workspace-create">
          <div class="sidebar-heading">
            <span class="sidebar-title">Create workspace</span>
          </div>
          <v-text-field
            v-model="newWorkspaceName"
            label="Name"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-rename-outline"
            hide-details
          />
          <v-select
            v-model="selectedImageId"
            :items="images"
            item-title="label"
            item-value="id"
            label="Image"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-cube-outline"
            hide-details
          />
          <v-btn
            color="primary"
            variant="elevated"
            size="large"
            prepend-icon="mdi-plus"
            :loading="creatingWorkspace"
            @click="createWorkspace"
          >
            New
          </v-btn>
        </div>

        <v-divider class="section-divider" />

        <div class="sidebar-section">
          <div class="sidebar-heading">
            <span class="sidebar-title">Files</span>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-file-tree-outline">
              {{ files.length }}
            </v-chip>
          </div>
          <div class="file-create">
            <v-text-field
              v-model="newPath"
              label="Path"
              density="comfortable"
              variant="solo-filled"
              prepend-inner-icon="mdi-file-code-outline"
              hide-details
            />
            <v-btn
              icon="mdi-file-plus-outline"
              color="primary"
              variant="tonal"
              size="large"
              title="Create file"
              :loading="creatingFile"
              :disabled="!selectedWorkspace"
              @click="createFile"
            />
          </div>
        </div>

        <FileTree
          :files="files"
          :active-file-id="activeFile?.id ?? null"
          :locations="presence"
          @open="activeFile = $event"
        />
      </div>
    </v-navigation-drawer>

    <v-main class="main-surface">
      <v-alert v-if="error" type="error" density="comfortable" variant="tonal" class="error-banner">
        {{ error }}
      </v-alert>
      <section v-if="activePage === 'workspace' && !mdAndUp" class="mobile-workspace-panel">
        <div class="mobile-workspace-controls">
          <v-select
            v-model="selectedWorkspaceId"
            :items="workspaces"
            item-title="name"
            item-value="id"
            label="Workspace"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-view-dashboard-outline"
            hide-details
          />
          <div class="file-create">
            <v-text-field
              v-model="newPath"
              label="Path"
              density="comfortable"
              variant="solo-filled"
              prepend-inner-icon="mdi-file-code-outline"
              hide-details
            />
            <v-btn
              icon="mdi-file-plus-outline"
              color="primary"
              variant="tonal"
              size="large"
              title="Create file"
              :loading="creatingFile"
              :disabled="!selectedWorkspace"
              @click="createFile"
            />
          </div>
        </div>
        <FileTree
          :files="files"
          :active-file-id="activeFile?.id ?? null"
          :locations="presence"
          @open="activeFile = $event"
        />
      </section>
      <div
        v-if="activePage === 'workspace'"
        class="editor-shell"
        :class="{ 'editor-shell--compact': !mdAndUp }"
      >
        <header class="editor-toolbar">
          <div class="editor-title-row">
            <v-icon class="editor-file-icon" icon="mdi-file-code-outline" size="24" />
            <div class="editor-title-group">
              <p class="editor-title">{{ activeFile?.path ?? "No file selected" }}</p>
              <div v-if="selectedWorkspace" class="editor-meta">
                <span class="muted">{{ selectedWorkspace.imageRef }}</span>
                <v-chip
                  class="status-chip"
                  size="x-small"
                  variant="flat"
                  :prepend-icon="selectedWorkspaceStatusIcon"
                  :data-status="selectedWorkspace.containerStatus"
                >
                  {{ selectedWorkspace.containerStatus }}
                </v-chip>
              </div>
            </div>
          </div>
          <v-chip v-if="presence.length" size="small" variant="tonal" prepend-icon="mdi-account-multiple-outline">
            {{ presence.length }}
          </v-chip>
        </header>
        <CodeEditor :file="activeFile" :access-token="accessToken" :user="currentUser" />
      </div>
      <section v-else class="settings-page">
        <div class="settings-header">
          <div>
            <p class="settings-eyebrow">Settings</p>
            <h1>Appearance</h1>
          </div>
          <v-chip size="small" variant="tonal" prepend-icon="mdi-theme-light-dark">
            {{ effectiveThemeLabel }}
          </v-chip>
        </div>

        <div class="settings-grid">
          <section class="settings-card settings-card--wide">
            <div class="settings-card-header">
              <div class="settings-card-icon">
                <v-icon icon="mdi-palette-outline" size="24" />
              </div>
              <div>
                <h2>Theme</h2>
                <p>{{ effectiveThemeLabel }}</p>
              </div>
            </div>

            <div class="theme-options" role="radiogroup" aria-label="Theme">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                class="theme-option"
                :class="{ 'theme-option--selected': themePreference === option.value }"
                type="button"
                role="radio"
                :aria-checked="themePreference === option.value"
                @click="themePreference = option.value"
              >
                <span class="theme-preview" :data-preview="option.value">
                  <span />
                  <span />
                  <span />
                </span>
                <span class="theme-option-body">
                  <v-icon :icon="option.icon" size="22" />
                  <span>{{ option.title }}</span>
                </span>
                <v-icon
                  class="theme-option-check"
                  :icon="themePreference === option.value ? 'mdi-check-circle' : 'mdi-circle-outline'"
                  size="20"
                />
              </button>
            </div>
          </section>

          <section class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">
                <v-icon icon="mdi-account-circle-outline" size="24" />
              </div>
              <div>
                <h2>Account</h2>
                <p>{{ currentUser.name }}</p>
              </div>
            </div>
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-logout" @click="signOut">
              Sign out
            </v-btn>
          </section>

          <section class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-icon">
                <v-icon icon="mdi-view-dashboard-outline" size="24" />
              </div>
              <div>
                <h2>Workspace</h2>
                <p>{{ selectedWorkspace?.name ?? "No workspace" }}</p>
              </div>
            </div>
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-left" @click="activePage = 'workspace'">
              Open workspace
            </v-btn>
          </section>
        </div>
      </section>
    </v-main>
  </v-app>
</template>


<style scoped>
.nav-rail-items {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: min-content;
  margin-inline: auto;
  align-items: center;
}
</style>
