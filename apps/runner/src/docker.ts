import Docker from "dockerode"
import tar from "tar-stream"
import { normalizeWorkspacePath } from "@whaler/shared"
import { env } from "./env"

export const docker = new Docker({
  socketPath: env.dockerSocketPath
})

function containerName(workspaceId: string): string {
  return `whaler-${workspaceId}`
}

function volumeName(workspaceId: string): string {
  return `whaler-workspace-${workspaceId}`
}

async function ensureImage(image: string): Promise<void> {
  const stream = await docker.pull(image)
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (error: Error | null) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function createContainer(input: { workspaceId: string; image: string }) {
  await ensureImage(input.image)
  const name = containerName(input.workspaceId)
  const volume = volumeName(input.workspaceId)

  try {
    const existing = docker.getContainer(name)
    const info = await existing.inspect()
    if (!info.State.Running) {
      await existing.start()
    }
    return {
      id: info.Id,
      status: "running" as const
    }
  } catch {
    await docker.createVolume({ Name: volume }).catch(() => undefined)
  }

  const container = await docker.createContainer({
    Image: input.image,
    name,
    Cmd: ["sleep", "infinity"],
    WorkingDir: "/workspace",
    Labels: {
      "whaler.workspace_id": input.workspaceId,
      "whaler.managed": "true"
    },
    HostConfig: {
      Binds: [`${volume}:/workspace`],
      Memory: env.memoryBytes,
      NanoCpus: env.nanoCpus,
      PidsLimit: env.pidsLimit,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      NetworkMode: "none",
      AutoRemove: false
    }
  })

  await container.start()
  const info = await container.inspect()
  return {
    id: info.Id,
    status: "running" as const
  }
}

export async function putWorkspaceEntry(input: {
  workspaceId: string
  path: string
  kind: "file" | "directory"
  content?: string | undefined
}) {
  const safePath = normalizeWorkspacePath(input.path)
  const container = docker.getContainer(containerName(input.workspaceId))
  const pack = tar.pack()

  if (input.kind === "directory") {
    pack.entry({ name: safePath, type: "directory", mode: 0o755 }, (error) => {
      if (error) pack.destroy(error)
      else pack.finalize()
    })
  } else {
    pack.entry({ name: safePath, mode: 0o644 }, input.content ?? "", (error) => {
      if (error) pack.destroy(error)
      else pack.finalize()
    })
  }

  await container.putArchive(pack, {
    path: "/workspace"
  })
}
