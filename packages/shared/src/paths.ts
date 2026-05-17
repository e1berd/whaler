export function normalizeWorkspacePath(input: string): string {
  const clean = input.replaceAll("\\", "/").trim()

  if (!clean || clean.includes("\0")) {
    throw new Error("Path is empty or invalid")
  }

  if (clean.startsWith("/") || clean.startsWith("~")) {
    throw new Error("Absolute paths are not allowed")
  }

  const parts = clean.split("/").filter(Boolean)
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Path traversal is not allowed")
  }

  return parts.join("/")
}

export function parentPath(path: string): string | null {
  const parts = path.split("/")
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join("/")
}

export function basename(path: string): string {
  return path.split("/").at(-1) ?? path
}
