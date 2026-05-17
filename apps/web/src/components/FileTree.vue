<script setup lang="ts">
import { computed } from "vue"
import type { FileLocation } from "@whaler/shared"

type WorkspaceFile = {
  id: string
  workspaceId: string
  path: string
  kind: "file" | "directory"
  language: string | null
}

const props = defineProps<{
  files: WorkspaceFile[]
  activeFileId: string | null
  locations: Array<{ user: { id: string; name: string; color: string }; location?: FileLocation }>
}>()

const emit = defineEmits<{
  open: [file: WorkspaceFile]
}>()

const sorted = computed(() =>
  [...props.files].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
    return a.path.localeCompare(b.path)
  })
)

function depth(path: string): number {
  return Math.max(0, path.split("/").length - 1)
}

function name(path: string): string {
  return path.split("/").at(-1) ?? path
}

function usersForFile(fileId: string) {
  return props.locations.filter((entry) => entry.location?.fileId === fileId).map((entry) => entry.user)
}
</script>

<template>
  <v-list density="compact" nav class="file-tree">
    <v-list-item
      v-for="file in sorted"
      :key="file.id"
      :active="file.id === activeFileId"
      :disabled="file.kind === 'directory'"
      lines="one"
      :style="{ paddingInlineStart: `${12 + depth(file.path) * 16}px` }"
      @click="file.kind === 'file' && emit('open', file)"
    >
      <template #prepend>
        <v-icon
          class="file-icon"
          :icon="file.kind === 'directory' ? 'mdi-folder-outline' : 'mdi-file-code-outline'"
        />
      </template>
      <v-list-item-title>{{ name(file.path) }}</v-list-item-title>
      <template #append>
        <div class="presence-dots" :aria-label="`${usersForFile(file.id).length} users`">
          <span
            v-for="user in usersForFile(file.id)"
            :key="user.id"
            class="presence-dot"
            :style="{ backgroundColor: user.color }"
            :title="user.name"
          />
        </div>
      </template>
    </v-list-item>
  </v-list>
</template>
