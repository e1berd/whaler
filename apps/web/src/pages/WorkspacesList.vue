<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "@kitbag/router"
import type { SandboxImage } from "@whaler/shared"
import { client, handleUnauthorizedResponse, useSession } from "@/lib/session"

type PublicWorkspace = {
  id: string
  name: string
  imageId: string
  imageRef: string
  visibility: "public" | "protected"
  hasPassword: boolean
  containerStatus: "pending" | "starting" | "running" | "stopped" | "error"
  memberCount: number
  isMember: boolean
  ownerId: string
  createdAt: string
}

const router = useRouter()
const { session } = useSession()

const items = ref<PublicWorkspace[]>([])
const images = ref<SandboxImage[]>([])
const query = ref("")
const imageFilter = ref<string | null>(null)
const loading = ref(false)
const joining = ref<string | null>(null)
const error = ref<string | null>(null)
const passwordDialog = ref<{ workspace: PublicWorkspace; password: string; error: string | null } | null>(null)

const filteredItems = computed(() => items.value)

let searchTimer: number | null = null

async function loadImages() {
  const response = await client().v1.images.$get()
  if (!response.ok) return
  images.value = Array.from((await response.json()).images, (image) => ({
    ...image,
    languages: [...image.languages]
  }))
}

async function loadWorkspaces() {
  loading.value = true
  error.value = null
  try {
    const queryParams: { q?: string; imageId?: string } = {}
    if (query.value.trim()) queryParams.q = query.value.trim()
    if (imageFilter.value) queryParams.imageId = imageFilter.value
    const response = await client().v1.workspaces.$get({ query: queryParams })
    if (!response.ok) {
      if (await handleUnauthorizedResponse(response)) return
      error.value = "Failed to load workspaces"
      return
    }
    const payload = (await response.json()) as { workspaces: PublicWorkspace[] }
    items.value = payload.workspaces
  } finally {
    loading.value = false
  }
}

function statusIcon(status: PublicWorkspace["containerStatus"]) {
  switch (status) {
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
}

function imageLabel(imageId: string) {
  return images.value.find((image) => image.id === imageId)?.label ?? imageId
}

async function openWorkspace(workspace: PublicWorkspace, password?: string) {
  joining.value = workspace.id
  error.value = null
  try {
    const response = await client().v1.workspaces[":workspaceId"].join.$post({
      param: { workspaceId: workspace.id },
      json: password ? { password } : {}
    })
    if (!response.ok) {
      if (await handleUnauthorizedResponse(response)) return
      if (response.status === 403) {
        if (passwordDialog.value) passwordDialog.value.error = "Invalid password"
        else
          passwordDialog.value = {
            workspace,
            password: "",
            error: workspace.hasPassword ? "Password required" : null
          }
        return
      }
      error.value = await response.text()
      return
    }
    passwordDialog.value = null
    router.push("workspace-detail", { workspaceId: workspace.id })
  } finally {
    joining.value = null
  }
}

function onWorkspaceClick(workspace: PublicWorkspace) {
  if (workspace.isMember || !workspace.hasPassword) {
    void openWorkspace(workspace)
    return
  }
  passwordDialog.value = { workspace, password: "", error: null }
}

async function submitPassword() {
  if (!passwordDialog.value) return
  const { workspace, password } = passwordDialog.value
  await openWorkspace(workspace, password)
}

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadWorkspaces(), 220)
})

watch(imageFilter, () => void loadWorkspaces())

watch(
  () => session.value?.access_token,
  (token) => {
    if (token) {
      void loadImages()
      void loadWorkspaces()
    }
  }
)

onMounted(() => {
  if (session.value) {
    void loadImages()
    void loadWorkspaces()
  }
})
</script>

<template>
  <section class="workspaces-page">
    <header class="workspaces-header">
      <div class="workspaces-title">
        <h1>Workspaces</h1>
        <p>Public rooms — join any project to collaborate in realtime.</p>
      </div>
      <v-btn color="primary" variant="elevated" prepend-icon="mdi-plus" size="large" @click="router.push('workspace-create')">
        New workspace
      </v-btn>
    </header>

    <div class="workspaces-filters">
      <v-text-field
        v-model="query"
        label="Search"
        density="comfortable"
        variant="solo-filled"
        prepend-inner-icon="mdi-magnify"
        clearable
        hide-details
      />
      <v-select
        v-model="imageFilter"
        :items="[{ id: null, label: 'All images' }, ...images]"
        item-title="label"
        item-value="id"
        label="Image"
        density="comfortable"
        variant="solo-filled"
        prepend-inner-icon="mdi-cube-outline"
        hide-details
        clearable
      />
    </div>

    <v-alert v-if="error" type="error" density="comfortable" variant="tonal" class="error-banner">
      {{ error }}
    </v-alert>

    <div v-if="loading && !items.length" class="workspaces-loading">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="!filteredItems.length" class="workspaces-empty">
      <v-icon icon="mdi-folder-search-outline" size="48" />
      <p>No workspaces match your search.</p>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="router.push('workspace-create')">
        Create the first one
      </v-btn>
    </div>

    <div v-else class="workspace-grid">
      <article
        v-for="workspace in filteredItems"
        :key="workspace.id"
        class="workspace-card"
        :class="{ 'workspace-card--joining': joining === workspace.id }"
        tabindex="0"
        role="button"
        @click="onWorkspaceClick(workspace)"
        @keydown.enter="onWorkspaceClick(workspace)"
      >
        <div class="workspace-card-head">
          <div class="workspace-card-icon">
            <v-icon icon="mdi-cube-outline" />
          </div>
          <div class="workspace-card-title">
            <h2>{{ workspace.name }}</h2>
            <span class="workspace-card-image">{{ imageLabel(workspace.imageId) }}</span>
          </div>
          <v-icon
            v-if="workspace.hasPassword"
            class="workspace-lock"
            icon="mdi-lock-outline"
            size="20"
            :title="workspace.isMember ? 'Joined' : 'Password protected'"
          />
        </div>
        <div class="workspace-card-meta">
          <v-chip
            class="status-chip"
            size="x-small"
            variant="flat"
            :prepend-icon="statusIcon(workspace.containerStatus)"
            :data-status="workspace.containerStatus"
          >
            {{ workspace.containerStatus }}
          </v-chip>
          <v-chip size="x-small" variant="tonal" prepend-icon="mdi-account-multiple-outline">
            {{ workspace.memberCount }}
          </v-chip>
          <v-chip v-if="workspace.isMember" size="x-small" variant="tonal" prepend-icon="mdi-check">
            Joined
          </v-chip>
        </div>
      </article>
    </div>

    <v-dialog :model-value="!!passwordDialog" max-width="420" @update:model-value="(value) => !value && (passwordDialog = null)">
      <v-card v-if="passwordDialog" rounded="xl" class="password-dialog">
        <v-card-title>
          <v-icon icon="mdi-lock-outline" class="me-2" />
          {{ passwordDialog.workspace.name }}
        </v-card-title>
        <v-card-text>
          <p class="mb-3">This workspace is password-protected.</p>
          <v-text-field
            v-model="passwordDialog.password"
            type="password"
            label="Password"
            autocomplete="off"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-key-outline"
            hide-details
            autofocus
            @keydown.enter="submitPassword"
          />
          <v-alert v-if="passwordDialog.error" type="error" density="compact" variant="tonal" class="mt-3">
            {{ passwordDialog.error }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="passwordDialog = null">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="joining === passwordDialog.workspace.id"
            @click="submitPassword"
          >
            Join
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.workspaces-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 28px 32px;
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
}

.workspaces-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.workspaces-title h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.workspaces-title p {
  margin: 4px 0 0;
  color: var(--md-sys-color-on-surface-variant);
}

.workspaces-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 12px;
}

@media (max-width: 640px) {
  .workspaces-filters {
    grid-template-columns: 1fr;
  }
}

.workspaces-loading {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.workspaces-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--md-sys-color-on-surface-variant);
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.workspace-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-large);
  cursor: pointer;
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1), box-shadow 160ms cubic-bezier(0.2, 0, 0, 1), border-color 160ms;
}

.workspace-card:hover,
.workspace-card:focus-visible {
  transform: translateY(-2px);
  border-color: var(--md-sys-color-primary);
  box-shadow: var(--md-sys-elevation-2);
  outline: none;
}

.workspace-card--joining {
  opacity: 0.7;
  pointer-events: none;
}

.workspace-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.workspace-card-title {
  flex: 1;
  min-width: 0;
}

.workspace-card-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-card-image {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.workspace-lock {
  color: var(--md-sys-color-on-surface-variant);
}

.workspace-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
  margin: 0;
}
</style>
