import "vuetify/styles"
import "@mdi/font/css/materialdesignicons.css"
import "./styles/app.css"

import { createApp } from "vue"
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"
import App from "./App.vue"

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: "mdi"
  },
  theme: {
    defaultTheme: "whaler",
    themes: {
      whaler: {
        dark: false,
        colors: {
          background: "#f7f8fa",
          surface: "#ffffff",
          primary: "#1f6feb",
          secondary: "#0f766e",
          error: "#b91c1c",
          info: "#0369a1",
          success: "#15803d",
          warning: "#b45309"
        }
      }
    }
  }
})

createApp(App).use(vuetify).mount("#app")
