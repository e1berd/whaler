import { serve } from "@hono/node-server"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { createContainer, putWorkspaceEntry } from "./docker"
import { env } from "./env"

const containerSchema = z.object({
  workspaceId: z.string().uuid(),
  image: z.string().min(1)
})

const fileSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["file", "directory"]),
  content: z.string().optional()
})

const app = new Hono()

app.use("/internal/*", async (c, next) => {
  if (!env.token || c.req.header("x-runner-token") !== env.token) {
    throw new HTTPException(401, { message: "Unauthorized runner request" })
  }

  await next()
})

app.get("/health", (c) => c.json({ ok: true }))

app.post("/internal/containers", zValidator("json", containerSchema), async (c) => {
  const body = c.req.valid("json")
  const result = await createContainer(body)

  return c.json({
    containerId: result.id,
    status: result.status
  })
})

app.put("/internal/workspaces/:workspaceId/files", zValidator("json", fileSchema), async (c) => {
  const workspaceId = c.req.param("workspaceId")
  const body = c.req.valid("json")

  await putWorkspaceEntry({
    workspaceId,
    path: body.path,
    kind: body.kind,
    ...(body.content === undefined ? {} : { content: body.content })
  })

  return c.json({ ok: true })
})

serve(
  {
    fetch: app.fetch,
    port: env.port
  },
  (info) => {
    console.log(`runner listening on http://localhost:${info.port}`)
  }
)
