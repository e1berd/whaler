import { and, eq } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { collabDocuments, files, workspaceMembers, workspaces } from "@whaler/db/schema"
import { getSandboxImage, normalizeWorkspacePath } from "@whaler/shared"
import { db } from "./db"
import type { AuthUser } from "./auth"

export async function assertWorkspaceAccess(workspaceId: string, user: AuthUser) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1)

  if (!member) {
    throw new HTTPException(404, { message: "Workspace not found" })
  }

  return member
}

export async function assertFileAccess(fileId: string, user: AuthUser) {
  const [row] = await db
    .select({
      file: files,
      member: workspaceMembers
    })
    .from(files)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, files.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .where(eq(files.id, fileId))
    .limit(1)

  if (!row) {
    throw new HTTPException(404, { message: "File not found" })
  }

  return row.file
}

export function languageFromPath(path: string): string | null {
  const extension = path.split(".").at(-1)?.toLowerCase()
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
    case "mjs":
      return "javascript"
    case "json":
      return "json"
    case "py":
      return "python"
    case "html":
      return "html"
    case "css":
      return "css"
    case "md":
      return "markdown"
    case "yml":
    case "yaml":
      return "yaml"
    default:
      return null
  }
}

export async function createWorkspaceWithDefaults(input: {
  user: AuthUser
  name: string
  imageId: string
}) {
  const image = getSandboxImage(input.imageId)
  if (!image) {
    throw new HTTPException(400, { message: "Image is not allowlisted" })
  }

  const now = new Date()
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: input.user.id,
        name: input.name,
        imageId: image.id,
        imageRef: image.image,
        containerStatus: "starting",
        updatedAt: now
      })
      .returning()

    if (!workspace) {
      throw new HTTPException(500, { message: "Workspace was not created" })
    }

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: input.user.id,
      role: "owner"
    })

    await tx.insert(files).values([
      {
        workspaceId: workspace.id,
        path: "README.md",
        kind: "file",
        language: "markdown",
        content: `# ${input.name}\n\nWorkspace image: ${image.image}\n`
      },
      {
        workspaceId: workspace.id,
        path: "src",
        kind: "directory",
        language: null,
        content: ""
      },
      {
        workspaceId: workspace.id,
        path: "src/main.ts",
        kind: "file",
        language: "typescript",
        content: "console.log('hello from whaler')\n"
      }
    ])

    return workspace
  })
}

export async function upsertPlainContentDocument(input: {
  fileId: string
  workspaceId: string
  content: string
}) {
  await db
    .insert(collabDocuments)
    .values({
      name: `file:${input.fileId}`,
      fileId: input.fileId,
      workspaceId: input.workspaceId,
      state: Buffer.from(input.content)
    })
    .onConflictDoNothing()
}

export function parseWorkspacePath(path: string): string {
  try {
    return normalizeWorkspacePath(path)
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid path"
    })
  }
}
