export type SandboxImage = {
  id: string
  label: string
  image: string
  description: string
  languages: string[]
}

export const SANDBOX_IMAGES = [
  {
    id: "node-22",
    label: "Node.js 22",
    image: "node:22-bookworm-slim",
    description: "TypeScript, JavaScript, Vite, tooling",
    languages: ["typescript", "javascript", "json", "html", "css"]
  },
  {
    id: "python-313",
    label: "Python 3.13",
    image: "python:3.13-slim",
    description: "Python scripts and small services",
    languages: ["python", "toml", "yaml", "json"]
  },
  {
    id: "bun-12",
    label: "Bun 1.2",
    image: "oven/bun:1.2",
    description: "Bun runtime and package tooling",
    languages: ["typescript", "javascript", "json"]
  },
  {
    id: "deno-2",
    label: "Deno 2",
    image: "denoland/deno:2.3.5",
    description: "Deno runtime with TypeScript-first workflow",
    languages: ["typescript", "javascript", "json"]
  }
] as const satisfies readonly SandboxImage[]

export type SandboxImageId = (typeof SANDBOX_IMAGES)[number]["id"]

export function getSandboxImage(id: string): SandboxImage | undefined {
  return SANDBOX_IMAGES.find((image) => image.id === id)
}
