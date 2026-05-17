import "vuetify/styles"
import "@mdi/font/css/materialdesignicons.css"
import "./styles/app.css"

import { createApp } from "vue"
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"
import App from "./App.vue"

const whalerLight = {
  dark: false,
  colors: {
    background: "#fdf8ff",
    surface: "#fdf8ff",
    "surface-bright": "#fdf8ff",
    "surface-dim": "#ddd8e0",
    "surface-container-lowest": "#ffffff",
    "surface-container-low": "#f7f2fa",
    "surface-container": "#f1ecf4",
    "surface-container-high": "#ece6ee",
    "surface-container-highest": "#e6e1e9",
    "on-surface": "#1b1b21",
    "on-surface-variant": "#45464f",
    "surface-variant": "#e2e1ec",
    outline: "#767680",
    "outline-variant": "#c6c5d0",
    primary: "#3f5f92",
    "on-primary": "#ffffff",
    "primary-container": "#d7e3ff",
    "on-primary-container": "#001b3e",
    secondary: "#565f71",
    "on-secondary": "#ffffff",
    "secondary-container": "#dae2f9",
    "on-secondary-container": "#131c2b",
    tertiary: "#705575",
    "on-tertiary": "#ffffff",
    "tertiary-container": "#fad8fd",
    "on-tertiary-container": "#28132e",
    error: "#ba1a1a",
    "on-error": "#ffffff",
    "error-container": "#ffdad6",
    "on-error-container": "#410002",
    info: "#006782",
    success: "#226b35",
    warning: "#7a5600"
  }
}

const whalerDark = {
  dark: true,
  colors: {
    background: "#131318",
    surface: "#131318",
    "surface-bright": "#39393f",
    "surface-dim": "#131318",
    "surface-container-lowest": "#0e0e13",
    "surface-container-low": "#1b1b21",
    "surface-container": "#1f1f25",
    "surface-container-high": "#29292f",
    "surface-container-highest": "#34343a",
    "on-surface": "#e6e1e9",
    "on-surface-variant": "#c6c5d0",
    "surface-variant": "#45464f",
    outline: "#90909a",
    "outline-variant": "#45464f",
    primary: "#abc7ff",
    "on-primary": "#0a305f",
    "primary-container": "#284777",
    "on-primary-container": "#d7e3ff",
    secondary: "#bec6dc",
    "on-secondary": "#283141",
    "secondary-container": "#3e4759",
    "on-secondary-container": "#dae2f9",
    tertiary: "#ddbce0",
    "on-tertiary": "#3f2845",
    "tertiary-container": "#573e5d",
    "on-tertiary-container": "#fad8fd",
    error: "#ffb4ab",
    "on-error": "#690005",
    "error-container": "#93000a",
    "on-error-container": "#ffdad6",
    info: "#86d2ee",
    success: "#a4d5a6",
    warning: "#e8c46c"
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
      rounded: "xl"
    },
    VCard: {
      rounded: "xl"
    },
    VChip: {
      rounded: "lg"
    },
    VSelect: {
      color: "primary"
    },
    VTextField: {
      color: "primary"
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

createApp(App).use(vuetify).mount("#app")
