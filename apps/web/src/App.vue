<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue"
import { useRouter } from "@kitbag/router"
import { useDisplay, useTheme } from "vuetify"
import AuthView from "@/components/AuthView.vue"
import { initSession, signOut, teardownSession, useSession } from "@/lib/session"
import {
  applyDocumentTheme,
  effectiveThemeLabel,
  effectiveThemeName,
  initializeThemePreference,
  teardownTheme
} from "@/lib/theme"

const router = useRouter()
const theme = useTheme()
const { mdAndUp } = useDisplay()
const { session, authReady, authNotice, currentUser } = useSession()

onMounted(async () => {
  initializeThemePreference()
  await initSession()
})

onBeforeUnmount(() => {
  teardownSession()
  teardownTheme()
})

watch(
  effectiveThemeName,
  (themeName) => {
    theme.change(themeName)
    applyDocumentTheme(themeName)
  },
  { immediate: true }
)
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
            <span class="app-page-title">Realtime sandbox editor</span>
          </div>
        </div>
      </v-app-bar-title>
      <v-spacer />
      <div class="app-bar-actions">
        <v-chip class="theme-chip" size="small" variant="tonal" prepend-icon="mdi-palette-outline">
          {{ effectiveThemeLabel }}
        </v-chip>
        <v-chip class="user-chip" size="small" variant="tonal">
          <template #prepend>
            <span class="user-chip-avatar" :style="{ backgroundColor: currentUser.color }">
              <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" :alt="currentUser.name" />
              <template v-else>{{ currentUser.name.charAt(0).toUpperCase() }}</template>
            </span>
          </template>
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
              icon="mdi-view-dashboard-outline"
              variant="text"
              title="Workspaces"
              @click="router.push('home')"
            />
          </nav>
          <nav>
            <v-btn
              class="nav-rail-button"
              icon="mdi-plus-box-outline"
              variant="text"
              title="New workspace"
              @click="router.push('workspace-create')"
            />
          </nav>
          <nav>
            <v-btn
              class="nav-rail-button"
              icon="mdi-cog-outline"
              variant="text"
              title="Settings"
              @click="router.push('settings')"
            />
          </nav>
        </div>
      </div>
    </v-navigation-drawer>

    <v-main class="main-surface">
      <router-view />
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
  gap: 10px;
  padding-top: 16px;
}

.user-chip-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: 600;
  font-size: 11px;
  margin-right: 6px;
}

.user-chip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
