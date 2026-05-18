<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useRouter } from "@kitbag/router"
import type { SandboxImage } from "@whaler/shared"
import { client, handleUnauthorizedResponse } from "@/lib/session"

const router = useRouter()

const images = ref<SandboxImage[]>([])
const name = ref("Untitled workspace")
const selectedImageId = ref<string | null>(null)
const protectWithPassword = ref(false)
const password = ref("")
const submitting = ref(false)
const error = ref<string | null>(null)

async function loadImages() {
  const response = await client().v1.images.$get()
  if (!response.ok) return
  images.value = Array.from((await response.json()).images, (image) => ({
    ...image,
    languages: [...image.languages]
  }))
  selectedImageId.value = images.value[0]?.id ?? null
}

async function submit() {
  if (!selectedImageId.value) return
  if (protectWithPassword.value && password.value.trim().length < 4) {
    error.value = "Password must be at least 4 characters"
    return
  }

  submitting.value = true
  error.value = null

  try {
    const response = await client().v1.workspaces.$post({
      json: {
        name: name.value.trim(),
        imageId: selectedImageId.value,
        password: protectWithPassword.value ? password.value.trim() : null
      }
    })
    if (!response.ok) {
      if (await handleUnauthorizedResponse(response)) return
      error.value = await response.text()
      return
    }
    const payload = (await response.json()) as { workspace: { id: string } }
    router.push("workspace-detail", { workspaceId: payload.workspace.id })
  } finally {
    submitting.value = false
  }
}

onMounted(loadImages)
</script>

<template>
  <section class="create-page">
    <header class="create-header">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.push('home')" />
      <div>
        <h1>New workspace</h1>
        <p>Spin up a sandbox container and invite people to collaborate.</p>
      </div>
    </header>

    <v-form class="create-form" @submit.prevent="submit">
      <v-text-field
        v-model="name"
        label="Workspace name"
        density="comfortable"
        variant="solo-filled"
        prepend-inner-icon="mdi-rename-outline"
        hide-details
      />

      <div class="image-section">
        <span class="section-label">Sandbox image</span>
        <div class="image-grid">
          <button
            v-for="image in images"
            :key="image.id"
            type="button"
            class="image-card"
            :class="{ 'image-card--selected': selectedImageId === image.id }"
            @click="selectedImageId = image.id"
          >
            <v-icon icon="mdi-cube-outline" size="22" />
            <div class="image-card-body">
              <span class="image-card-title">{{ image.label }}</span>
              <span class="image-card-desc">{{ image.description }}</span>
            </div>
            <v-icon
              class="image-card-check"
              :icon="selectedImageId === image.id ? 'mdi-check-circle' : 'mdi-circle-outline'"
              size="20"
            />
          </button>
        </div>
      </div>

      <div class="access-section">
        <v-switch
          v-model="protectWithPassword"
          color="primary"
          label="Protect with password"
          density="comfortable"
          hide-details
          inset
        />
        <p class="muted">Public workspaces are visible to everyone; password-protected ones still appear in the list but require the password to join.</p>
        <v-text-field
          v-if="protectWithPassword"
          v-model="password"
          type="password"
          label="Password"
          autocomplete="new-password"
          density="comfortable"
          variant="solo-filled"
          prepend-inner-icon="mdi-key-outline"
          hide-details
        />
      </div>

      <v-alert v-if="error" type="error" density="compact" variant="tonal">
        {{ error }}
      </v-alert>

      <div class="create-actions">
        <v-btn variant="text" @click="router.push('home')">Cancel</v-btn>
        <v-btn type="submit" color="primary" variant="elevated" prepend-icon="mdi-plus" :loading="submitting">
          Create workspace
        </v-btn>
      </div>
    </v-form>
  </section>
</template>

<style scoped>
.create-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}

.create-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.create-header h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
}

.create-header p {
  margin: 4px 0 0;
  color: var(--md-sys-color-on-surface-variant);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-large);
}

.image-section,
.access-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.image-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--md-sys-shape-medium);
  background: var(--md-sys-color-surface-container-low);
  border: 1px solid var(--md-sys-color-outline-variant);
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  transition: border-color 160ms, background 160ms;
}

.image-card:hover {
  border-color: var(--md-sys-color-primary);
}

.image-card--selected {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.image-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.image-card-title {
  font-weight: 600;
}

.image-card-desc {
  font-size: 12px;
  opacity: 0.75;
}

.image-card-check {
  margin-inline-start: auto;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
