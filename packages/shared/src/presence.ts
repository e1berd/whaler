export type AwarenessUser = {
  id: string
  name: string
  email?: string
  color: string
}

export type FileLocation = {
  workspaceId: string
  fileId: string | null
  path: string | null
}

export function colorFromUserId(userId: string): string {
  const palette = [
    "#2563eb",
    "#059669",
    "#dc2626",
    "#7c3aed",
    "#d97706",
    "#0891b2",
    "#be123c",
    "#4f46e5"
  ]

  let hash = 0
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return palette[Math.abs(hash) % palette.length] ?? "#2563eb"
}
