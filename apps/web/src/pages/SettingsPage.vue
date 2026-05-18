<script setup lang="ts">
import { computed, ref } from "vue"
import { useRouter } from "@kitbag/router"
import { signOut, updateProfile, useSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { effectiveThemeLabel, themePreference, type ThemePreference } from "@/lib/theme"

const router = useRouter()
const { currentUser, profile, session } = useSession()

const themeOptions = [
  { value: "light", icon: "mdi-white-balance-sunny", title: "Light" },
  { value: "dark", icon: "mdi-weather-night", title: "Dark" },
  { value: "system", icon: "mdi-theme-light-dark", title: "System" }
] satisfies Array<{ value: ThemePreference; icon: string; title: string }>

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

const label = computed(() => effectiveThemeLabel.value)
const avatarUrl = computed(() => profile.value?.avatarUrl ?? currentUser.value.avatarUrl ?? null)
const initial = computed(() => currentUser.value.name.charAt(0).toUpperCase())

function pickAvatar() {
  uploadError.value = null
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return
  if (!session.value?.user?.id) {
    uploadError.value = "Not signed in"
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    uploadError.value = "Image must be smaller than 2MB"
    return
  }

  uploading.value = true
  uploadError.value = null
  try {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `${session.value.user.id}/avatar.${extension}`
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
      cacheControl: "0"
    })
    if (uploadErr) {
      uploadError.value = uploadErr.message
      return
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path)
    const versioned = `${data.publicUrl}?v=${Date.now()}`
    await updateProfile({ avatarUrl: versioned })
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : "Upload failed"
  } finally {
    uploading.value = false
  }
}

async function removeAvatar() {
  uploading.value = true
  uploadError.value = null
  try {
    await updateProfile({ avatarUrl: null })
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : "Failed to remove avatar"
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <section class="settings-page">
    <header class="settings-header">
      <div>
        <p class="settings-eyebrow">Settings</p>
        <h1>Appearance</h1>
      </div>
      <v-chip size="small" variant="tonal" prepend-icon="mdi-theme-light-dark">{{ label }}</v-chip>
    </header>

    <div class="settings-grid">
      <section class="settings-card settings-card--wide">
        <div class="settings-card-header">
          <div class="settings-card-icon">
            <v-icon icon="mdi-palette-outline" size="24" />
          </div>
          <div>
            <h2>Theme</h2>
            <p>{{ label }}</p>
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

      <section class="settings-card settings-card--wide">
        <div class="settings-card-header">
          <div class="settings-card-icon">
            <v-icon icon="mdi-image-outline" size="24" />
          </div>
          <div>
            <h2>Avatar</h2>
            <p>Shown to others in the room and in cursors.</p>
          </div>
        </div>

        <div class="avatar-row">
          <div class="avatar-preview" :style="{ backgroundColor: currentUser.color }">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="currentUser.name" />
            <span v-else>{{ initial }}</span>
          </div>
          <div class="avatar-controls">
            <v-btn
              color="primary"
              variant="elevated"
              prepend-icon="mdi-upload-outline"
              :loading="uploading"
              @click="pickAvatar"
            >
              {{ avatarUrl ? "Replace" : "Upload" }}
            </v-btn>
            <v-btn
              v-if="avatarUrl"
              variant="text"
              prepend-icon="mdi-trash-can-outline"
              :disabled="uploading"
              @click="removeAvatar"
            >
              Remove
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style="display: none"
              @change="handleFileChange"
            />
          </div>
        </div>
        <v-alert v-if="uploadError" type="error" density="compact" variant="tonal">
          {{ uploadError }}
        </v-alert>
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
            <h2>Workspaces</h2>
            <p>Browse and join projects</p>
          </div>
        </div>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-left" @click="router.push('home')">
          Go to workspaces
        </v-btn>
      </section>
    </div>
  </section>
</template>

<style scoped>
.avatar-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-size: 28px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
