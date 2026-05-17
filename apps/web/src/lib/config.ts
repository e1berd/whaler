export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321"
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "dev-anon-key"

export function collabUrl(): string {
  const configured = import.meta.env.VITE_COLLAB_URL
  if (configured) return configured

  if (typeof window === "undefined") return "ws://localhost:3001"
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  if (window.location.port === "5173") return "ws://localhost:3001"

  return `${protocol}//${window.location.host}/collab`
}
