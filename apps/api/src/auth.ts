import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose"
import { profiles } from "@whaler/db/schema"
import { colorFromUserId } from "@whaler/shared"
import { db } from "./db"
import { env } from "./env"

export type AuthUser = {
  id: string
  email?: string
  role?: string
}

type JwtPayload = {
  sub?: string
  email?: string
  role?: string
}

const secret = new TextEncoder().encode(env.supabaseJwtSecret)
const jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.supabaseUrl))

export async function verifySupabaseAccessToken(token: string): Promise<AuthUser> {
  const { alg } = decodeProtectedHeader(token)
  const { payload } =
    alg === "HS256"
      ? await jwtVerify(token, secret, { algorithms: ["HS256"] })
      : await jwtVerify(token, jwks, { algorithms: ["ES256", "RS256"] })

  const typed = payload as JwtPayload
  if (!typed.sub) {
    throw new Error("Supabase token does not contain sub")
  }

  const user: AuthUser = {
    id: typed.sub
  }

  if (typed.email) user.email = typed.email
  if (typed.role) user.role = typed.role

  return user
}

export async function upsertProfile(user: AuthUser): Promise<void> {
  const now = new Date()
  await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email,
      displayName: user.email?.split("@")[0] ?? "User",
      color: colorFromUserId(user.id),
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: user.email,
        updatedAt: now
      }
    })
}

export const requireAuth = createMiddleware<{
  Variables: {
    user: AuthUser
  }
}>(async (c, next) => {
  const header = c.req.header("authorization")
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null

  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token" })
  }

  try {
    const user = await verifySupabaseAccessToken(token)
    await upsertProfile(user)
    c.set("user", user)
    await next()
  } catch {
    throw new HTTPException(401, { message: "Invalid bearer token" })
  }
})
