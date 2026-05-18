<script setup lang="ts">
import { computed, ref } from "vue"
import type { EditorView } from "@codemirror/view"
import { autoUpdate, flip, offset, shift, useFloating, type VirtualElement } from "@floating-ui/vue"

const props = defineProps<{
  view: EditorView
  pos: number
  name: string
  color: string
}>()

const floating = ref<HTMLElement | null>(null)

const reference = computed<VirtualElement>(() => {
  const pos = props.pos
  return {
    getBoundingClientRect() {
      const coords = props.view.coordsAtPos(pos)
      if (!coords) {
        return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
      }
      const left = coords.left
      const top = coords.top
      const bottom = coords.bottom
      return {
        x: left,
        y: top,
        top,
        left,
        right: left,
        bottom,
        width: 0,
        height: bottom - top
      }
    }
  }
})

const { floatingStyles } = useFloating(reference, floating, {
  placement: "top-start",
  strategy: "fixed",
  middleware: [
    offset(4),
    flip({ fallbackPlacements: ["bottom-start", "top-end", "bottom-end"] }),
    shift({ padding: 8 })
  ],
  whileElementsMounted: autoUpdate
})
</script>

<template>
  <span ref="floating" class="remote-cursor-label" :style="[floatingStyles, { backgroundColor: color }]">
    {{ name }}
  </span>
</template>

<style scoped>
.remote-cursor-label {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 200;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.01em;
  line-height: 1.2;
}
</style>
