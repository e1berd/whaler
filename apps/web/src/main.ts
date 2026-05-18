import "vuetify/styles"
import "@mdi/font/css/materialdesignicons.css"
import "@fontsource/monaspace-neon/500.css"
import "./styles/app.css"

import { createApp } from "vue"
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"
import App from "./App.vue"
import { router } from "./router"

const whalerLight = {
  dark: false,
  colors: {
    background: "#fafafc",
    surface: "#fafafc",
    "surface-bright": "#ffffff",
    "surface-dim": "#dcdde3",
    "surface-container-lowest": "#ffffff",
    "surface-container-low": "#f3f3f6",
    "surface-container": "#ecedf0",
    "surface-container-high": "#e4e5ea",
    "surface-container-highest": "#dcdde3",
    "on-surface": "#1a1c1f",
    "on-surface-variant": "#494c52",
    "surface-variant": "#e0e2e7",
    outline: "#767880",
    "outline-variant": "#c8cad0",
    primary: "#3d5680",
    "on-primary": "#ffffff",
    "primary-container": "#d6e2f6",
    "on-primary-container": "#001b3b",
    secondary: "#545c6b",
    "on-secondary": "#ffffff",
    "secondary-container": "#dde2ec",
    "on-secondary-container": "#181c25",
    tertiary: "#6b566f",
    "on-tertiary": "#ffffff",
    "tertiary-container": "#f1d9f4",
    "on-tertiary-container": "#251329",
    error: "#b3261e",
    "on-error": "#ffffff",
    "error-container": "#f9dedc",
    "on-error-container": "#410e0b",
    info: "#1d6b86",
    success: "#386b48",
    warning: "#7a5800"
  }
}

const whalerDark = {
  dark: true,
  colors: {
    background: "#111216",
    surface: "#111216",
    "surface-bright": "#3a3c45",
    "surface-dim": "#111216",
    "surface-container-lowest": "#0a0b0e",
    "surface-container-low": "#181a1f",
    "surface-container": "#1d1f24",
    "surface-container-high": "#272930",
    "surface-container-highest": "#32343c",
    "on-surface": "#e3e4e8",
    "on-surface-variant": "#c4c6cc",
    "surface-variant": "#45474e",
    outline: "#8e9097",
    "outline-variant": "#45474e",
    primary: "#a8c4ed",
    "on-primary": "#0c3057",
    "primary-container": "#26466f",
    "on-primary-container": "#d6e2f6",
    secondary: "#bcc4d8",
    "on-secondary": "#2a3140",
    "secondary-container": "#3c4453",
    "on-secondary-container": "#dde2ec",
    tertiary: "#d8bcdb",
    "on-tertiary": "#3b2a40",
    "tertiary-container": "#523f56",
    "on-tertiary-container": "#f1d9f4",
    error: "#f2b8b5",
    "on-error": "#601410",
    "error-container": "#8c1d18",
    "on-error-container": "#f9dedc",
    info: "#86d2ee",
    success: "#a3d2ac",
    warning: "#e9c170"
  }
}

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: "mdi"
  },
  defaults: {
    VBtn: {
      rounded: "pill",
      ripple: true
    },
    VCard: {
      rounded: "lg"
    },
    VChip: {
      rounded: "pill"
    },
    VSelect: {
      color: "primary",
      variant: "solo-filled"
    },
    VTextField: {
      color: "primary",
      variant: "solo-filled"
    },
    VTooltip: {
      openDelay: 200
    }
  },
  theme: {
    defaultTheme: "whalerLight",
    themes: {
      whalerLight,
      whalerDark
    }
  }
})

createApp(App).use(vuetify).use(router).mount("#app")
