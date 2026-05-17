import { env } from "./env"

type RunnerContainerResponse = {
  containerId: string
  status: "running" | "starting"
}

async function runnerFetch(path: string, init: RequestInit): Promise<Response | null> {
  if (!env.runnerInternalUrl || !env.runnerInternalToken) {
    return null
  }

  return fetch(`${env.runnerInternalUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-runner-token": env.runnerInternalToken,
      ...(init.headers ?? {})
    }
  })
}

export async function createSandboxContainer(input: {
  workspaceId: string
  image: string
}): Promise<RunnerContainerResponse | null> {
  const response = await runnerFetch("/internal/containers", {
    method: "POST",
    body: JSON.stringify(input)
  })

  if (!response) return null
  if (!response.ok) {
    throw new Error(await response.text())
  }

  return (await response.json()) as RunnerContainerResponse
}

export async function mirrorWorkspaceEntry(input: {
  workspaceId: string
  path: string
  kind: "file" | "directory"
  content?: string | undefined
}): Promise<void> {
  const response = await runnerFetch(`/internal/workspaces/${input.workspaceId}/files`, {
    method: "PUT",
    body: JSON.stringify(input)
  })

  if (!response) return
  if (!response.ok) {
    throw new Error(await response.text())
  }
}
