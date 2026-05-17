<script setup lang="ts">
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
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

const session = ref<Session | null>(null)
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

let presenceProvider: HocuspocusProvider | null = null
let presenceDoc: Y.Doc | null = null

const accessToken = computed(() => session.value?.access_token ?? "")
const selectedWorkspace = computed(() => workspaces.value.find((item) => item.id === selectedWorkspaceId.value) ?? null)
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

function client() {
  if (!accessToken.value) throw new Error("Missing session")
  return apiClient(accessToken.value)
}

async function loadInitialData() {
  if (!session.value) return
  error.value = null
  const api = client()
  const [imagesResponse, workspacesResponse] = await Promise.all([
    api.v1.images.$get(),
    api.v1.workspaces.$get()
  ])

  if (!imagesResponse.ok || !workspacesResponse.ok) {
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
  await supabase.auth.signOut()
}

onMounted(async () => {
  const result = await supabase.auth.getSession()
  session.value = result.data.session
  await loadInitialData()
  await loadFiles()

  supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, nextSession: Session | null) => {
    session.value = nextSession
    if (nextSession) {
      await loadInitialData()
      await loadFiles()
    } else {
      disposePresence()
    }
  })
})

watch(selectedWorkspaceId, async () => {
  await loadFiles()
  connectPresence()
})

watch(activeFile, updatePresenceLocation)
watch(currentUser, () => presenceProvider?.setAwarenessField("user", currentUser.value))

onBeforeUnmount(disposePresence)
</script>

<template>
  <AuthView v-if="!session" />
  <v-app v-else>
    <v-app-bar density="compact" flat border>
      <v-app-bar-title class="app-title">Whaler</v-app-bar-title>
      <v-spacer />
      <v-chip size="small" variant="tonal" prepend-icon="mdi-account-circle">
        {{ currentUser.name }}
      </v-chip>
      <v-btn icon="mdi-logout" variant="text" title="Sign out" @click="signOut" />
    </v-app-bar>

    <v-navigation-drawer width="320" permanent border>
      <div class="sidebar-section">
        <v-select
          v-model="selectedWorkspaceId"
          :items="workspaces"
          item-title="name"
          item-value="id"
          label="Workspace"
          density="compact"
          variant="outlined"
          hide-details
        />
      </div>

      <div class="sidebar-section workspace-create">
        <v-text-field
          v-model="newWorkspaceName"
          label="Name"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-select
          v-model="selectedImageId"
          :items="images"
          item-title="label"
          item-value="id"
          label="Image"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-plus"
          :loading="creatingWorkspace"
          @click="createWorkspace"
        >
          New
        </v-btn>
      </div>

      <v-divider />

      <div class="sidebar-section file-create">
        <v-text-field
          v-model="newPath"
          label="Path"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-btn
          icon="mdi-file-plus-outline"
          variant="tonal"
          size="small"
          title="Create file"
          :loading="creatingFile"
          :disabled="!selectedWorkspace"
          @click="createFile"
        />
      </div>

      <FileTree
        :files="files"
        :active-file-id="activeFile?.id ?? null"
        :locations="presence"
        @open="activeFile = $event"
      />
    </v-navigation-drawer>

    <v-main>
      <v-alert v-if="error" type="error" density="compact" variant="tonal" class="ma-3">
        {{ error }}
      </v-alert>
      <div class="editor-shell">
        <header class="editor-toolbar">
          <div>
            <strong>{{ activeFile?.path ?? "No file" }}</strong>
            <span v-if="selectedWorkspace" class="muted">
              {{ selectedWorkspace.imageRef }} · {{ selectedWorkspace.containerStatus }}
            </span>
          </div>
        </header>
        <CodeEditor :file="activeFile" :access-token="accessToken" :user="currentUser" />
      </div>
    </v-main>
  </v-app>
</template>
