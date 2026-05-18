import { and, eq } from "drizzle-orm"
import { workspaceMembers, workspaces } from "@whaler/db/schema"
import { db } from "./db"
import type { VoiceUser } from "./auth"

export async function assertWorkspaceMember(workspaceId: string, user: VoiceUser): Promise<void> {
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1)
  if (member) return

  const [workspace] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (workspace?.ownerId === user.id) return

  throw new Error("Forbidden")
}
