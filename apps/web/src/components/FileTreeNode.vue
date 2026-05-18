<script setup lang="ts">
import type { FileLocation } from "@whaler/shared"

type WorkspaceFile = {
  id: string
  workspaceId: string
  path: string
  kind: "file" | "directory"
  language: string | null
}

type PresenceUser = { id: string; name: string; color: string }

export type TreeNode = {
  id: string | null
  name: string
  path: string
  kind: "file" | "directory"
  language: string | null
  file: WorkspaceFile | null
  children: TreeNode[]
}

const props = defineProps<{
  node: TreeNode
  depth: number
  collapsed: Set<string>
  activeFileId: string | null
  renamingId: string | null
  renameDraft: string
  locations: Array<{ user: PresenceUser; location?: FileLocation }>
}>()

const emit = defineEmits<{
  toggle: [node: TreeNode]
  activate: [node: TreeNode]
  context: [event: MouseEvent, node: TreeNode]
  "rename-input": [value: string]
  "rename-submit": [node: TreeNode]
  "rename-cancel": []
}>()

function usersForId(id: string | null) {
  if (!id) return []
  return props.locations.filter((entry) => entry.location?.fileId === id).map((entry) => entry.user)
}

function onRenameKey(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
    emit("rename-submit", props.node)
  } else if (event.key === "Escape") {
    event.preventDefault()
    emit("rename-cancel")
  }
}
</script>

<template>
  <div
    class="ft-row"
    :class="{ 'ft-row--active': activeFileId && node.id === activeFileId }"
    @click="emit('activate', node)"
    @contextmenu="emit('context', $event, node)"
  >
    <span class="ft-row-toggle" :style="{ marginLeft: `${depth * 12}px` }">
      <i
        v-if="node.kind === 'directory'"
        :class="`mdi ${collapsed.has(node.path) ? 'mdi-chevron-right' : 'mdi-chevron-down'}`"
        @click.stop="emit('toggle', node)"
      />
    </span>
    <i
      class="mdi ft-row-icon"
      :class="
        node.kind === 'directory'
          ? collapsed.has(node.path)
            ? 'mdi-folder-outline'
            : 'mdi-folder-open-outline'
          : 'mdi-file-outline'
      "
    />
    <input
      v-if="renamingId && node.id === renamingId"
      class="ft-rename-input"
      :value="renameDraft"
      autofocus
      @click.stop
      @input="emit('rename-input', ($event.target as HTMLInputElement).value)"
      @keydown="onRenameKey"
      @blur="emit('rename-submit', node)"
    />
    <span v-else class="ft-row-name">{{ node.name }}</span>
    <span v-if="usersForId(node.id).length" class="ft-row-presence">
      <span
        v-for="user in usersForId(node.id)"
        :key="user.id"
        class="ft-row-dot"
        :style="{ backgroundColor: user.color }"
        :title="user.name"
      />
    </span>
  </div>
  <template v-if="node.kind === 'directory' && !collapsed.has(node.path)">
    <FileTreeNode
      v-for="child in node.children"
      :key="child.path"
      :node="child"
      :depth="depth + 1"
      :collapsed="collapsed"
      :active-file-id="activeFileId"
      :renaming-id="renamingId"
      :rename-draft="renameDraft"
      :locations="locations"
      @toggle="emit('toggle', $event)"
      @activate="emit('activate', $event)"
      @context="(event, n) => emit('context', event, n)"
      @rename-input="emit('rename-input', $event)"
      @rename-submit="emit('rename-submit', $event)"
      @rename-cancel="emit('rename-cancel')"
    />
  </template>
</template>

<style scoped>
.ft-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 6px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  min-height: 24px;
  line-height: 1.3;
  color: var(--md-sys-color-on-surface);
  user-select: none;
}

.ft-row:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.ft-row--active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.ft-row-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
}

.ft-row-icon {
  font-size: 16px;
  color: var(--md-sys-color-on-surface-variant);
}

.ft-row--active .ft-row-icon {
  color: var(--md-sys-color-on-primary-container);
}

.ft-row-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ft-row-presence {
  display: inline-flex;
  gap: 3px;
}

.ft-row-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ft-rename-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--md-sys-color-primary);
  border-radius: 4px;
  padding: 1px 4px;
  font: inherit;
  background: var(--md-sys-color-surface-container-lowest);
  color: var(--md-sys-color-on-surface);
  outline: none;
}
</style>
