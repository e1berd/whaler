import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#ff79c6" },
  { tag: [t.controlKeyword, t.modifier, t.operatorKeyword], color: "#ff79c6" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#f8f8f2" },
  { tag: [t.propertyName], color: "#8be9fd" },
  { tag: [t.function(t.variableName), t.labelName], color: "#82e0aa" },
  { tag: [t.variableName], color: "#f8f8f2" },
  { tag: [t.definition(t.variableName), t.definition(t.name)], color: "#f1fa8c" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#bd93f9" },
  { tag: [t.string, t.special(t.string)], color: "#a5e3a1" },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: "#ffb86c" },
  { tag: t.atom, color: "#bd93f9" },
  { tag: [t.bool, t.null], color: "#bd93f9" },
  { tag: [t.number, t.integer, t.float], color: "#ffb86c" },
  { tag: [t.typeName, t.className, t.namespace], color: "#8be9fd" },
  { tag: [t.operator, t.punctuation, t.derefOperator], color: "#cdd6f4" },
  { tag: [t.bracket, t.squareBracket, t.paren, t.angleBracket], color: "#cdd6f4" },
  { tag: t.comment, color: "#7a7f9a", fontStyle: "italic" },
  { tag: t.meta, color: "#7a7f9a" },
  { tag: t.tagName, color: "#ff79c6" },
  { tag: t.attributeName, color: "#82e0aa" },
  { tag: t.attributeValue, color: "#a5e3a1" },
  { tag: t.heading, color: "#ff79c6", fontWeight: "600" },
  { tag: t.link, color: "#8be9fd", textDecoration: "underline" },
  { tag: t.invalid, color: "#ff5555" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" }
])

const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#9333ea" },
  { tag: [t.controlKeyword, t.modifier, t.operatorKeyword], color: "#9333ea" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#1f2937" },
  { tag: t.propertyName, color: "#0369a1" },
  { tag: [t.function(t.variableName), t.labelName], color: "#15803d" },
  { tag: t.variableName, color: "#1f2937" },
  { tag: [t.definition(t.variableName), t.definition(t.name)], color: "#c2410c" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#7c3aed" },
  { tag: [t.string, t.special(t.string)], color: "#047857" },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: "#b45309" },
  { tag: t.atom, color: "#7c3aed" },
  { tag: [t.bool, t.null], color: "#7c3aed" },
  { tag: [t.number, t.integer, t.float], color: "#b45309" },
  { tag: [t.typeName, t.className, t.namespace], color: "#0369a1" },
  { tag: [t.operator, t.punctuation, t.derefOperator], color: "#374151" },
  { tag: [t.bracket, t.squareBracket, t.paren, t.angleBracket], color: "#374151" },
  { tag: t.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: t.meta, color: "#6b7280" },
  { tag: t.tagName, color: "#9333ea" },
  { tag: t.attributeName, color: "#15803d" },
  { tag: t.attributeValue, color: "#047857" },
  { tag: t.heading, color: "#9333ea", fontWeight: "600" },
  { tag: t.link, color: "#0369a1", textDecoration: "underline" },
  { tag: t.invalid, color: "#dc2626" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" }
])

export function editorHighlight(mode: "light" | "dark") {
  return syntaxHighlighting(mode === "dark" ? darkHighlight : lightHighlight, { fallback: true })
}

export function editorBaseTheme(mode: "light" | "dark") {
  const isDark = mode === "dark"
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        background: isDark ? "#1a1a22" : "#fdfdff",
        color: isDark ? "#e6e1e9" : "#1b1b21",
        fontSize: "14px"
      },
      ".cm-scroller": {
        fontFamily: "'Monaspace Neon', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        fontWeight: "500",
        lineHeight: "1.55"
      },
      ".cm-content": {
        caretColor: isDark ? "#abc7ff" : "#3f5f92",
        padding: "18px 0",
        fontWeight: "500"
      },
      ".cm-line": {
        padding: "0 18px"
      },
      ".cm-gutters": {
        background: isDark ? "#16161d" : "#f4f1f9",
        color: isDark ? "#7a7f9a" : "#7a7080",
        border: "none",
        borderRight: isDark ? "1px solid #2a2a35" : "1px solid #e2e1ec"
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        background: isDark
          ? "color-mix(in srgb, #abc7ff 12%, transparent)"
          : "color-mix(in srgb, #3f5f92 10%, transparent)"
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        background: isDark
          ? "color-mix(in srgb, #abc7ff 26%, transparent)"
          : "color-mix(in srgb, #3f5f92 24%, transparent)"
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: isDark ? "#abc7ff" : "#3f5f92"
      },
      ".cm-ySelectionInfo": {
        display: "none"
      }
    },
    { dark: isDark }
  )
}
