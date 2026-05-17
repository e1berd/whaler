<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue"
import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { python } from "@codemirror/lang-python"
import { EditorState } from "@codemirror/state"
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language"
import { HocuspocusProvider } from "@hocuspocus/provider"
import { yCollab } from "y-codemirror.next"
import * as Y from "yjs"
import type { AwarenessUser } from "@whaler/shared"
import { collabUrl } from "@/lib/config"

type WorkspaceFile = {
  id: string
  path: string
  language: string | null
}

const props = defineProps<{
  file: WorkspaceFile | null
  accessToken: string
  user: AwarenessUser
}>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null
let provider: HocuspocusProvider | null = null
let ydoc: Y.Doc | null = null

function languageExtension(language: string | null, path: string) {
  if (language === "typescript") return javascript({ typescript: true })
  if (language === "javascript") return javascript()
  if (language === "json") return json()
  if (language === "python") return python()
  if (language === "html") return html()
  if (language === "css") return css()
  if (path.endsWith(".ts")) return javascript({ typescript: true })
  if (path.endsWith(".js")) return javascript()
  return []
}

function dispose() {
  view?.destroy()
  provider?.destroy()
  ydoc?.destroy()
  view = null
  provider = null
  ydoc = null
}

async function mountEditor() {
  dispose()
  await nextTick()

  if (!host.value || !props.file) {
    return
  }

  ydoc = new Y.Doc()
  provider = new HocuspocusProvider({
    url: collabUrl(),
    name: `file:${props.file.id}`,
    document: ydoc,
    token: props.accessToken
  })

  provider.setAwarenessField("user", props.user)

  const ytext = ydoc.getText("content")
  const undoManager = new Y.UndoManager(ytext)

  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            background: "var(--md-sys-color-surface-container-lowest)",
            color: "var(--md-sys-color-on-surface)",
            fontSize: "14px"
          },
          ".cm-scroller": {
            fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
            lineHeight: "1.55"
          },
          ".cm-content": {
            caretColor: "var(--md-sys-color-primary)",
            padding: "18px 0"
          },
          ".cm-line": {
            padding: "0 18px"
          },
          ".cm-gutters": {
            background: "var(--md-sys-color-surface-container-low)",
            borderRight: "1px solid var(--md-sys-color-outline-variant)"
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            background: "color-mix(in srgb, var(--md-sys-color-primary-container) 42%, transparent)"
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            background: "color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent)"
          }
        }),
        languageExtension(props.file.language, props.file.path),
        yCollab(ytext, provider.awareness, { undoManager })
      ]
    })
  })
}

watch(() => props.file?.id, mountEditor, { immediate: true })
watch(
  () => props.user,
  () => provider?.setAwarenessField("user", props.user),
  { deep: true }
)

onBeforeUnmount(dispose)
</script>

<template>
  <div v-if="file" ref="host" class="editor-host" />
  <div v-else class="editor-empty">
    <v-icon icon="mdi-file-code-outline" size="40" />
    <span>Select a file</span>
  </div>
</template>
