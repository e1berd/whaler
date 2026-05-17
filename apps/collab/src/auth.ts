import { jwtVerify } from "jose"
import { env } from "./env"

export type CollabUser = {
  id: string
  email?: string
  role?: string
}

const secret = new TextEncoder().encode(env.supabaseJwtSecret)

export async function verifyToken(token: string): Promise<CollabUser> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"]
  })

  if (!payload.sub) {
    throw new Error("Missing subject")
  }

  const user: CollabUser = {
    id: String(payload.sub)
  }

  if (typeof payload.email === "string") user.email = payload.email
  if (typeof payload.role === "string") user.role = payload.role

  return user
}
