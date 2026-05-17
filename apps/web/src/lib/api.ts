import { hc } from "hono/client"
import type { AppType } from "@whaler/api/app"
import { API_URL } from "./config"

export function apiClient(accessToken: string) {
  return hc<AppType>(API_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  })
}
