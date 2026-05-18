<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useRoute, useRouter } from "@kitbag/router"
import { useDisplay } from "vuetify"
import { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import type { AwarenessUser, FileLocation } from "@whaler/shared"
import CodeEditor from "@/components/CodeEditor.vue"
import FileTree from "@/components/FileTree.vue"
import { collabUrl } from "@/lib/config"
import { client, handleUnauthorizedResponse, useSession } from "@/lib/session"

type WorkspaceDetail = {
  id: string
  name: string
  imageId: string
  imageRef: string
  visibility: "public" | "protected"
  hasPassword: boolean
  containerStatus: "pending" | "starting" | "running" | "stopped" | "error"
  ownerId: string
  isMember: boolean
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

const route = useRoute("workspace-detail")
const router = useRouter()
const { accessToken, currentUser } = useSession()
const { mdAndUp } = useDisplay()

const workspace = ref<WorkspaceDetail | null>(null)
const workspaceLoading = ref(false)
const accessDenied = ref(false)
const files = ref<WorkspaceFile[]>([])
const activeFile = ref<WorkspaceFile | null>(null)
const presence = ref<PresenceEntry[]>([])
const error = ref<string | null>(null)
const createDialog = ref<{ parent: string; kind: "file" | "directory"; name: string } | null>(null)
const submittingCreate = ref(false)
let lastTreeRevision = 0

let presenceProvider: HocuspocusProvider | null = null
let presenceDoc: Y.Doc | null = null

const workspaceId = computed(() => route.params.workspaceId)

const statusIcon = computed(() => {
  switch (workspace.value?.containerStatus) {
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

const presenceList = computed(() => {
  const seen = new Set<string>()
  return presence.value.filter((entry) => {
    if (!entry.user || seen.has(entry.user.id)) return false
    seen.add(entry.user.id)
    return true
  })
})

async function loadWorkspace() {
  workspaceLoading.value = true
  error.value = null
  accessDenied.value = false
  try {
    const response = await client().v1.workspaces[":workspaceId"].$get({
      param: { workspaceId: workspaceId.value }
    })
    if (!response.ok) {
      if (await handleUnauthorizedResponse(response)) return
      if (response.status === 404) {
        error.value = "Workspace not found"
      } else {
        error.value = await response.text()
      }
      workspace.value = null
      return
    }
    const payload = (await response.json()) as { workspace: WorkspaceDetail }
    workspace.value = payload.workspace
    if (!payload.workspace.isMember) {
      accessDenied.value = true
      return
    }
    await loadFiles()
    connectPresence()
  } finally {
    workspaceLoading.value = false
  }
}

async function loadFiles() {
  const response = await client().v1.workspaces[":workspaceId"].tree.$get({
    param: { workspaceId: workspaceId.value }
  })
  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) return
    error.value = "Failed to load files"
    return
  }
  files.value = ((await response.json()).files as WorkspaceFile[]).sort((a, b) => a.path.localeCompare(b.path))
  if (!activeFile.value || !files.value.find((file) => file.id === activeFile.value?.id)) {
    activeFile.value = files.value.find((file) => file.kind === "file") ?? null
  }
}

function broadcastTreeChange() {
  if (!presenceProvider) return
  lastTreeRevision = Date.now()
  presenceProvider.setAwarenessField("treeRevision", lastTreeRevision)
}

function openCreateDialog(parent: string, kind: "file" | "directory") {
  createDialog.value = {
    parent,
    kind,
    name: kind === "file" ? "new-file.ts" : "new-folder"
  }
}

async function submitCreateDialog() {
  const draft = createDialog.value
  if (!draft || !workspaceId.value) return
  const trimmed = draft.name.trim()
  if (!trimmed) return
  const fullPath = draft.parent ? `${draft.parent}/${trimmed}` : trimmed
  submittingCreate.value = true
  error.value = null
  try {
    const response = await client().v1.workspaces[":workspaceId"].files.$post({
      param: { workspaceId: workspaceId.value },
      json: {
        path: fullPath,
        kind: draft.kind,
        content: ""
      }
    })
    if (!response.ok) {
      if (await handleUnauthorizedResponse(response)) return
      error.value = await response.text()
      return
    }
    const payload = (await response.json()) as { file: WorkspaceFile }
    files.value.push(payload.file)
    if (payload.file.kind === "file") activeFile.value = payload.file
    createDialog.value = null
    broadcastTreeChange()
  } finally {
    submittingCreate.value = false
  }
}

async function renameFile(file: WorkspaceFile, nextPath: string) {
  error.value = null
  const response = await client().v1.files[":fileId"].$patch({
    param: { fileId: file.id },
    json: { path: nextPath }
  })
  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) return
    error.value = await response.text()
    return
  }
  await loadFiles()
  broadcastTreeChange()
}

async function deleteFile(file: WorkspaceFile) {
  error.value = null
  const confirmed = window.confirm(
    file.kind === "directory"
      ? `Delete folder "${file.path}" and everything inside?`
      : `Delete "${file.path}"?`
  )
  if (!confirmed) return
  const response = await client().v1.files[":fileId"].$delete({
    param: { fileId: file.id }
  })
  if (!response.ok) {
    if (await handleUnauthorizedResponse(response)) return
    error.value = await response.text()
    return
  }
  if (activeFile.value?.id === file.id) activeFile.value = null
  await loadFiles()
  broadcastTreeChange()
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
  if (!workspaceId.value || !accessToken.value) return

  presenceDoc = new Y.Doc()
  presenceProvider = new HocuspocusProvider({
    url: collabUrl(),
    name: `workspace:${workspaceId.value}:presence`,
    document: presenceDoc,
    token: accessToken.value
  })

  presenceProvider.setAwarenessField("user", currentUser.value)
  updatePresenceLocation()
  lastTreeRevision = 0

  presenceProvider.on(
    "awarenessUpdate",
    ({ states }: { states: Array<PresenceEntry & { clientId: number; treeRevision?: number }> }) => {
      presence.value = states.filter((entry) => entry.user)
      const localId = presenceProvider?.awareness?.clientID
      let maxRevision = 0
      for (const state of states) {
        if (state.clientId === localId) continue
        const value = state.treeRevision
        if (typeof value === "number" && value > maxRevision) maxRevision = value
      }
      if (maxRevision > lastTreeRevision) {
        lastTreeRevision = maxRevision
        void loadFiles()
      }
    }
  )
}

function updatePresenceLocation() {
  if (!presenceProvider || !workspaceId.value) return
  presenceProvider.setAwarenessField("location", {
    workspaceId: workspaceId.value,
    fileId: activeFile.value?.id ?? null,
    path: activeFile.value?.path ?? null
  } satisfies FileLocation)
}

watch(workspaceId, (value) => {
  if (value) void loadWorkspace()
  else disposePresence()
})

watch(activeFile, updatePresenceLocation)
watch(currentUser, () => presenceProvider?.setAwarenessField("user", currentUser.value), { deep: true })

if (workspaceId.value) void loadWorkspace()

onBeforeUnmount(disposePresence)
</script>

<template>
  <div v-if="workspaceLoading && !workspace" class="detail-loading">
    <v-progress-circular indeterminate color="primary" />
  </div>

  <section v-else-if="accessDenied" class="detail-empty">
    <v-icon icon="mdi-lock-outline" size="48" />
    <p>You don't have access to this workspace.</p>
    <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-left" @click="router.push('home')">
      Back to workspaces
    </v-btn>
  </section>

  <section v-else-if="workspace" class="detail-page">
    <aside v-if="mdAndUp" class="detail-sidebar">
      <header class="detail-sidebar-header">
        <v-btn icon="mdi-arrow-left" variant="text" size="small" title="Back" @click="router.push('home')" />
        <div class="detail-sidebar-title">
          <span class="workspace-name">{{ workspace.name }}</span>
          <span class="workspace-image">{{ workspace.imageRef }}</span>
        </div>
        <v-chip
          class="status-chip"
          size="x-small"
          variant="flat"
          :prepend-icon="statusIcon"
          :data-status="workspace.containerStatus"
        >
          {{ workspace.containerStatus }}
        </v-chip>
      </header>

      <div class="detail-sidebar-section">
        <span class="section-label">In the room</span>
        <div class="presence-list">
          <div v-for="entry in presenceList" :key="entry.user.id" class="presence-row" :title="entry.location?.path ?? 'Idle'">
            <span class="presence-avatar" :style="{ backgroundColor: entry.user.color }">
              <img v-if="entry.user.avatarUrl" :src="entry.user.avatarUrl" :alt="entry.user.name" />
              <template v-else>{{ entry.user.name.charAt(0).toUpperCase() }}</template>
            </span>
            <div class="presence-text">
              <span class="presence-name">{{ entry.user.name }}</span>
              <span class="presence-path">{{ entry.location?.path ?? "Idle" }}</span>
            </div>
          </div>
          <div v-if="!presenceList.length" class="presence-empty">Nobody else here yet.</div>
        </div>
      </div>

      <div class="detail-sidebar-section detail-files-section">
        <div class="section-heading">
          <span class="section-label">Files</span>
          <div class="section-heading-actions">
            <v-chip size="x-small" variant="tonal">{{ files.length }}</v-chip>
            <v-btn
              icon="mdi-file-plus-outline"
              variant="text"
              size="x-small"
              density="comfortable"
              title="New file"
              @click="openCreateDialog('', 'file')"
            />
            <v-btn
              icon="mdi-folder-plus-outline"
              variant="text"
              size="x-small"
              density="comfortable"
              title="New folder"
              @click="openCreateDialog('', 'directory')"
            />
          </div>
        </div>
        <FileTree
          :files="files"
          :active-file-id="activeFile?.id ?? null"
          :locations="presence"
          @open="activeFile = $event"
          @rename="renameFile"
          @remove="deleteFile"
          @create-in="openCreateDialog"
        />
      </div>
    </aside>

    <v-dialog :model-value="!!createDialog" max-width="420" @update:model-value="(value) => !value && (createDialog = null)">
      <v-card v-if="createDialog" rounded="xl">
        <v-card-title>
          <v-icon
            :icon="createDialog.kind === 'directory' ? 'mdi-folder-plus-outline' : 'mdi-file-plus-outline'"
            class="me-2"
          />
          {{ createDialog.kind === "directory" ? "New folder" : "New file" }}
        </v-card-title>
        <v-card-text>
          <p v-if="createDialog.parent" class="muted mb-2">In: {{ createDialog.parent }}/</p>
          <v-text-field
            v-model="createDialog.name"
            :label="createDialog.kind === 'directory' ? 'Folder name' : 'File name'"
            density="comfortable"
            variant="solo-filled"
            hide-details
            autofocus
            @keydown.enter="submitCreateDialog"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createDialog = null">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" :loading="submittingCreate" @click="submitCreateDialog">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <main class="detail-editor">
      <header class="editor-toolbar">
        <div class="editor-title-row">
          <v-icon class="editor-file-icon" icon="mdi-file-code-outline" size="24" />
          <div class="editor-title-group">
            <p class="editor-title">{{ activeFile?.path ?? "No file selected" }}</p>
            <span class="muted">{{ workspace.imageRef }}</span>
          </div>
        </div>
        <div class="editor-toolbar-meta">
          <v-chip
            v-if="presenceList.length"
            size="small"
            variant="tonal"
            prepend-icon="mdi-account-multiple-outline"
          >
            {{ presenceList.length }} online
          </v-chip>
        </div>
      </header>

      <v-alert v-if="error" type="error" density="comfortable" variant="tonal" class="error-banner">
        {{ error }}
      </v-alert>

      <div class="editor-host-wrapper">
        <CodeEditor :file="activeFile" :access-token="accessToken" :user="currentUser" />
      </div>
    </main>
  </section>

  <section v-else class="detail-empty">
    <v-icon icon="mdi-alert-circle-outline" size="48" />
    <p>{{ error ?? "Failed to load workspace" }}</p>
    <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-left" @click="router.push('home')">
      Back to workspaces
    </v-btn>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 0;
  height: 100%;
  min-height: 0;
}

@media (max-width: 960px) {
  .detail-page {
    grid-template-columns: 1fr;
  }
}

.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  background: var(--md-sys-color-surface-container-low);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  min-height: 0;
  overflow-y: auto;
}

.detail-sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-sidebar-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.workspace-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-image {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-files-section {
  flex: 1;
  min-height: 0;
}

.section-heading-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.presence-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.presence-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--md-sys-color-surface-container);
}

.presence-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}

.presence-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.presence-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.presence-name {
  font-weight: 600;
  font-size: 13px;
}

.presence-path {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.presence-empty {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  padding: 6px 10px;
}

.detail-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
}

.editor-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.editor-title-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-title {
  margin: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.muted {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.editor-host-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
}

.detail-loading,
.detail-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.status-chip[data-status="running"] {
  background: var(--md-sys-color-success-container);
  color: var(--md-sys-color-on-success-container);
}

.status-chip[data-status="error"] {
  background: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
}

.error-banner {
  margin: 12px 18px 0;
}
</style>
