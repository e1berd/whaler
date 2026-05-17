<script setup lang="ts">
import { ref } from "vue"
import { supabase } from "@/lib/supabase"

const email = ref("")
const password = ref("")
const loading = ref(false)
const mode = ref<"sign-in" | "sign-up">("sign-in")
const error = ref<string | null>(null)

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
    <section class="auth-panel">
      <div class="auth-brand">
        <div class="auth-logo">W</div>
        <div>
          <h1>Whaler</h1>
          <p>Realtime sandbox editor</p>
        </div>
      </div>

      <v-btn-toggle v-model="mode" divided mandatory density="comfortable" class="mb-5">
        <v-btn value="sign-in" prepend-icon="mdi-login">Sign in</v-btn>
        <v-btn value="sign-up" prepend-icon="mdi-account-plus">Sign up</v-btn>
      </v-btn-toggle>

      <v-form @submit.prevent="submit">
        <v-text-field
          v-model="email"
          type="email"
          label="Email"
          autocomplete="email"
          density="comfortable"
          variant="outlined"
        />
        <v-text-field
          v-model="password"
          type="password"
          label="Password"
          autocomplete="current-password"
          density="comfortable"
          variant="outlined"
        />
        <v-alert v-if="error" type="error" density="compact" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
        <v-btn
          type="submit"
          color="primary"
          block
          :loading="loading"
          prepend-icon="mdi-arrow-right"
        >
          {{ mode === "sign-in" ? "Sign in" : "Create account" }}
        </v-btn>
      </v-form>
    </section>
  </main>
</template>
