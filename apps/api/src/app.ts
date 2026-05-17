import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { files, workspaces } from "@whaler/db/schema"
import { SANDBOX_IMAGES } from "@whaler/shared"
import { requireAuth } from "./auth"
import { db } from "./db"
import { env } from "./env"
import { createSandboxContainer, mirrorWorkspaceEntry } from "./runner"
import {
  assertFileAccess,
  assertWorkspaceAccess,
  createWorkspaceWithDefaults,
  languageFromPath,
  parseWorkspacePath
} from "./workspaces"

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  imageId: z.string().trim().min(1).max(80)
})

const createFileSchema = z.object({
  path: z.string().trim().min(1).max(500),
  kind: z.enum(["file", "directory"]),
  content: z.string().optional()
})

const updateFileSchema = z.object({
  content: z.string()
})

const app = new Hono()

app.use(
  "*",
  cors({
    origin: env.appOrigin.split(",").map((origin) => origin.trim()),
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  })
)

const routes = app
  .get("/health", (c) => c.json({ ok: true }))
  .use("/v1/*", requireAuth)
  .get("/v1/me", (c) => c.json({ user: c.get("user") }))
  .get("/v1/images", (c) => c.json({ images: SANDBOX_IMAGES }))
  .get("/v1/workspaces", async (c) => {
    const user = c.get("user")
    const rows = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.id))
    return c.json({ workspaces: rows })
  })
  .post("/v1/workspaces", zValidator("json", createWorkspaceSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const workspace = await createWorkspaceWithDefaults({
      user,
      name: body.name,
      imageId: body.imageId
    })

    try {
      const runnerResult = await createSandboxContainer({
        workspaceId: workspace.id,
        image: workspace.imageRef
      })

      if (runnerResult) {
        const [updated] = await db
          .update(workspaces)
          .set({
            containerId: runnerResult.containerId,
            containerStatus: runnerResult.status,
            containerError: null,
            updatedAt: new Date()
          })
          .where(eq(workspaces.id, workspace.id))
          .returning()

        return c.json({ workspace: updated ?? workspace }, 201)
      }
    } catch (error) {
      await db
        .update(workspaces)
        .set({
          containerStatus: "error",
          containerError: error instanceof Error ? error.message : "Runner error",
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, workspace.id))
    }

    return c.json({ workspace }, 201)
  })
  .get("/v1/workspaces/:workspaceId/tree", async (c) => {
    const user = c.get("user")
    const workspaceId = c.req.param("workspaceId")
    await assertWorkspaceAccess(workspaceId, user)
    const rows = await db.select().from(files).where(eq(files.workspaceId, workspaceId))
    return c.json({ files: rows })
  })
  .post("/v1/workspaces/:workspaceId/files", zValidator("json", createFileSchema), async (c) => {
    const user = c.get("user")
    const workspaceId = c.req.param("workspaceId")
    const body = c.req.valid("json")
    await assertWorkspaceAccess(workspaceId, user)

    const path = parseWorkspacePath(body.path)
    const [file] = await db
      .insert(files)
      .values({
        workspaceId,
        path,
        kind: body.kind,
        language: body.kind === "file" ? languageFromPath(path) : null,
        content: body.kind === "file" ? body.content ?? "" : ""
      })
      .returning()

    if (!file) {
      throw new HTTPException(500, { message: "File was not created" })
    }

    await mirrorWorkspaceEntry({
      workspaceId,
      path,
      kind: body.kind,
      ...(body.content === undefined ? {} : { content: body.content })
    })

    return c.json({ file }, 201)
  })
  .get("/v1/files/:fileId", async (c) => {
    const user = c.get("user")
    const fileId = c.req.param("fileId")
    const file = await assertFileAccess(fileId, user)
    return c.json({ file })
  })
  .put("/v1/files/:fileId", zValidator("json", updateFileSchema), async (c) => {
    const user = c.get("user")
    const fileId = c.req.param("fileId")
    const body = c.req.valid("json")
    const file = await assertFileAccess(fileId, user)

    if (file.kind !== "file" || file.readonly) {
      throw new HTTPException(409, { message: "File cannot be modified" })
    }

    const [updated] = await db
      .update(files)
      .set({
        content: body.content,
        updatedAt: new Date()
      })
      .where(and(eq(files.id, fileId), eq(files.kind, "file")))
      .returning()

    if (!updated) {
      throw new HTTPException(404, { message: "File not found" })
    }

    await mirrorWorkspaceEntry({
      workspaceId: updated.workspaceId,
      path: updated.path,
      kind: "file",
      content: body.content
    })

    return c.json({ file: updated })
  })

export type AppType = typeof routes

export default app
