<script setup lang="ts">
import { computed, ref } from "vue"
import { supabase } from "@/lib/supabase"

defineProps<{
  notice?: string | null
}>()

const email = ref("")
const password = ref("")
const loading = ref(false)
const mode = ref<"sign-in" | "sign-up">("sign-in")
const error = ref<string | null>(null)

const heading = computed(() => (mode.value === "sign-in" ? "Welcome back" : "Create your account"))
const supporting = computed(() =>
  mode.value === "sign-in"
    ? "Sign in to jump into a workspace and pick up where you left off."
    : "Start a sandbox in seconds and invite teammates in realtime."
)

async function submit() {
  loading.value = true
  error.value = null

  const result =
    mode.value === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      : await supabase.auth.signUp({ email: email.value, password: password.value })

  if (result.error) {
    error.value = result.error.message
  }

  loading.value = false
}
</script>

<template>
  <main class="auth-screen">
    <section class="auth-shell">
      <aside class="auth-hero">
        <div class="auth-hero-mark">W</div>
        <div>
          <h1 class="auth-hero-title">Build together,<br />in any sandbox.</h1>
          <p class="auth-hero-sub">Realtime workspaces with voice, shared cursors and one-tap previews.</p>
        </div>
        <ul class="auth-hero-bullets">
          <li><span class="i">⚡</span> Spin up containers in seconds</li>
          <li><span class="i">🎙</span> Lossless voice while you ship</li>
          <li><span class="i">🌀</span> Live cursors and shared state</li>
        </ul>
      </aside>

      <section class="auth-panel">
        <p class="auth-eyebrow">Whaler</p>
        <h2 class="auth-heading">{{ heading }}</h2>
        <p class="auth-supporting">{{ supporting }}</p>

        <v-btn-toggle
          v-model="mode"
          mandatory
          density="comfortable"
          color="primary"
          class="auth-mode-toggle"
        >
          <v-btn value="sign-in" prepend-icon="mdi-login">Sign in</v-btn>
          <v-btn value="sign-up" prepend-icon="mdi-account-plus">Sign up</v-btn>
        </v-btn-toggle>

        <v-alert v-if="notice" type="info" density="comfortable" variant="tonal" rounded="lg">
          {{ notice }}
        </v-alert>

        <v-form class="auth-form" @submit.prevent="submit">
          <v-text-field
            v-model="email"
            type="email"
            label="Email"
            autocomplete="email"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-email-outline"
            hide-details="auto"
          />
          <v-text-field
            v-model="password"
            type="password"
            label="Password"
            :autocomplete="mode === 'sign-in' ? 'current-password' : 'new-password'"
            density="comfortable"
            variant="solo-filled"
            prepend-inner-icon="mdi-lock-outline"
            hide-details="auto"
          />
          <v-alert v-if="error" type="error" density="compact" variant="tonal" rounded="lg">
            {{ error }}
          </v-alert>
          <v-btn
            type="submit"
            color="primary"
            variant="elevated"
            block
            class="auth-submit"
            :loading="loading"
            append-icon="mdi-arrow-right"
          >
            {{ mode === "sign-in" ? "Sign in" : "Create account" }}
          </v-btn>
        </v-form>
      </section>
    </section>
  </main>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}
</style>
