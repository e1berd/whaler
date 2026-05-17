import { Server } from "@hocuspocus/server"
import { eq, sql as drizzleSql } from "drizzle-orm"
import * as Y from "yjs"
import { collabDocuments, files } from "@whaler/db/schema"
import { assertCanOpenFile, assertCanOpenWorkspace } from "./access"
import { verifyToken, type CollabUser } from "./auth"
import { db } from "./db"
import { env } from "./env"

type CollabContext = {
  user?: CollabUser
}

function fileIdFromDocumentName(documentName: string): string | null {
  return documentName.startsWith("file:") ? documentName.slice("file:".length) : null
}

function workspaceIdFromPresenceDocument(documentName: string): string | null {
  const match = /^workspace:([^:]+):presence$/.exec(documentName)
  return match?.[1] ?? null
}

const server = new Server<CollabContext>({
  port: env.port,

  async onAuthenticate(data) {
    if (!data.token || typeof data.token !== "string") {
      throw new Error("Missing token")
    }

    const user = await verifyToken(data.token)
    const fileId = fileIdFromDocumentName(data.documentName)
    const workspaceId = workspaceIdFromPresenceDocument(data.documentName)

    if (fileId) {
      await assertCanOpenFile(fileId, user)
    } else if (workspaceId) {
      await assertCanOpenWorkspace(workspaceId, user)
    } else {
      throw new Error("Unsupported document")
    }

    return { user }
  },

  async onLoadDocument(data) {
    const fileId = fileIdFromDocumentName(data.documentName)
    const doc = new Y.Doc()

    if (!fileId) {
      return doc
    }

    const user = data.context.user
    if (!user) {
      throw new Error("Missing auth context")
    }
    const file = await assertCanOpenFile(fileId, user)
    const [stored] = await db
      .select()
      .from(collabDocuments)
      .where(eq(collabDocuments.name, data.documentName))
      .limit(1)

    if (stored?.state) {
      Y.applyUpdate(doc, new Uint8Array(stored.state))
      return doc
    }

    doc.getText("content").insert(0, file.content)
    return doc
  },

  async onStoreDocument(data) {
    const fileId = fileIdFromDocumentName(data.documentName)
    if (!fileId) {
      return
    }

    const encoded = Buffer.from(Y.encodeStateAsUpdate(data.document))
    const text = data.document.getText("content").toString()
    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)

    if (!file) {
      return
    }

    await db
      .insert(collabDocuments)
      .values({
        name: data.documentName,
        workspaceId: file.workspaceId,
        fileId,
        state: encoded,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: collabDocuments.name,
        set: {
          state: encoded,
          version: drizzleSql`${collabDocuments.version} + 1`,
          updatedAt: new Date()
        }
      })

    await db
      .update(files)
      .set({
        content: text,
        updatedAt: new Date()
      })
      .where(eq(files.id, fileId))
  }
})

server.listen()
console.log(`collab listening on ws://localhost:${env.port}`)
