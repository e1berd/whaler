import { and, eq } from "drizzle-orm"
import { files, workspaceMembers } from "@whaler/db/schema"
import { db } from "./db"
import type { CollabUser } from "./auth"

export async function assertCanOpenFile(fileId: string, user: CollabUser) {
  const [row] = await db
    .select({
      file: files
    })
    .from(files)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, files.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .where(eq(files.id, fileId))
    .limit(1)

  if (!row) {
    throw new Error("File not found")
  }

  return row.file
}

export async function assertCanOpenWorkspace(workspaceId: string, user: CollabUser) {
  const [row] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1)

  if (!row) {
    throw new Error("Workspace not found")
  }
}
