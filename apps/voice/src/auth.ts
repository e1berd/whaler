import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose"
import { env } from "./env"

export type VoiceUser = {
  id: string
  email?: string
}

const secret = new TextEncoder().encode(env.supabaseJwtSecret)
const jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.supabaseUrl))

export async function verifyToken(token: string): Promise<VoiceUser> {
  const { alg } = decodeProtectedHeader(token)
  const { payload } =
    alg === "HS256"
      ? await jwtVerify(token, secret, { algorithms: ["HS256"] })
      : await jwtVerify(token, jwks, { algorithms: ["ES256", "RS256"] })

  if (!payload.sub) {
    throw new Error("Missing subject")
  }

  const user: VoiceUser = { id: String(payload.sub) }
  if (typeof payload.email === "string") user.email = payload.email
  return user
}
