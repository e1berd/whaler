<script setup lang="ts">
import { computed, ref } from "vue"
import type { FileLocation } from "@whaler/shared"
import FileTreeNode, { type TreeNode } from "@/components/FileTreeNode.vue"

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
  rename: [file: WorkspaceFile, nextPath: string]
  remove: [file: WorkspaceFile]
  createIn: [parentPath: string, kind: "file" | "directory"]
}>()

const collapsed = ref<Set<string>>(new Set())
const renamingId = ref<string | null>(null)
const renameDraft = ref("")
const menu = ref<{ x: number; y: number; node: TreeNode } | null>(null)
const showMenu = ref(false)

const tree = computed<TreeNode[]>(() => {
  const root: TreeNode = {
    id: null,
    name: "",
    path: "",
    kind: "directory",
    language: null,
    file: null,
    children: []
  }
  const directories = new Map<string, TreeNode>([["", root]])
  const sorted = [...props.files].sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sorted) {
    const parts = file.path.split("/")
    const name = parts.at(-1) ?? file.path
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const segPath = parts.slice(0, i + 1).join("/")
      let dir = directories.get(segPath)
      if (!dir) {
        dir = {
          id: null,
          name: parts[i] ?? segPath,
          path: segPath,
          kind: "directory",
          language: null,
          file: null,
          children: []
        }
        directories.set(segPath, dir)
        parent.children.push(dir)
      }
      parent = dir
    }
    if (file.kind === "directory") {
      const existing = directories.get(file.path)
      if (existing) {
        existing.id = file.id
        existing.file = file
      } else {
        const node: TreeNode = {
          id: file.id,
          name,
          path: file.path,
          kind: "directory",
          language: null,
          file,
          children: []
        }
        directories.set(file.path, node)
        parent.children.push(node)
      }
    } else {
      parent.children.push({
        id: file.id,
        name,
        path: file.path,
        kind: "file",
        language: file.language,
        file,
        children: []
      })
    }
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortNode)
  }
  sortNode(root)
  return root.children
})

function toggle(node: TreeNode) {
  if (node.kind !== "directory") return
  if (collapsed.value.has(node.path)) collapsed.value.delete(node.path)
  else collapsed.value.add(node.path)
}

function activate(node: TreeNode) {
  if (node.kind === "file" && node.file) emit("open", node.file)
  else toggle(node)
}

function openMenu(event: MouseEvent, node: TreeNode) {
  event.preventDefault()
  event.stopPropagation()
  menu.value = { x: event.clientX, y: event.clientY, node }
  showMenu.value = true
}

function openRootMenu(event: MouseEvent) {
  openMenu(event, {
    id: null,
    name: "",
    path: "",
    kind: "directory",
    language: null,
    file: null,
    children: []
  })
}

function closeMenu() {
  showMenu.value = false
  menu.value = null
}

function startRename(node: TreeNode) {
  if (!node.file) {
    closeMenu()
    return
  }
  renamingId.value = node.file.id
  renameDraft.value = node.name
  closeMenu()
}

function submitRename(node: TreeNode) {
  if (!node.file) {
    renamingId.value = null
    return
  }
  const trimmed = renameDraft.value.trim()
  if (!trimmed || trimmed === node.name) {
    renamingId.value = null
    return
  }
  const parts = node.path.split("/")
  parts[parts.length - 1] = trimmed
  emit("rename", node.file, parts.join("/"))
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function actionDelete(node: TreeNode) {
  if (!node.file) {
    closeMenu()
    return
  }
  emit("remove", node.file)
  closeMenu()
}

function actionCreate(node: TreeNode, kind: "file" | "directory") {
  const parent = node.kind === "directory" ? node.path : node.path.split("/").slice(0, -1).join("/")
  emit("createIn", parent, kind)
  closeMenu()
}
</script>

<template>
  <div class="file-tree" @contextmenu="openRootMenu">
    <FileTreeNode
      v-for="node in tree"
      :key="node.path"
      :node="node"
      :depth="0"
      :collapsed="collapsed"
      :active-file-id="activeFileId"
      :renaming-id="renamingId"
      :rename-draft="renameDraft"
      :locations="locations"
      @toggle="toggle"
      @activate="activate"
      @context="openMenu"
      @rename-input="(value) => (renameDraft = value)"
      @rename-submit="submitRename"
      @rename-cancel="cancelRename"
    />

    <v-menu
      v-model="showMenu"
      :target="menu ? [menu.x, menu.y] : undefined"
      :close-on-content-click="true"
      @update:model-value="(value) => !value && closeMenu()"
    >
      <v-list v-if="menu" density="compact" class="ft-menu">
        <template v-if="menu.node.file">
          <v-list-item prepend-icon="mdi-pencil-outline" @click="startRename(menu.node)">
            <v-list-item-title>Rename</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-trash-can-outline" @click="actionDelete(menu.node)">
            <v-list-item-title>Delete</v-list-item-title>
          </v-list-item>
          <v-divider v-if="menu.node.kind === 'directory'" />
        </template>
        <template v-if="menu.node.kind === 'directory'">
          <v-list-item prepend-icon="mdi-file-plus-outline" @click="actionCreate(menu.node, 'file')">
            <v-list-item-title>New file</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-folder-plus-outline" @click="actionCreate(menu.node, 'directory')">
            <v-list-item-title>New folder</v-list-item-title>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.ft-menu {
  background: var(--md-sys-color-surface-container);
  min-width: 180px;
}
</style>
