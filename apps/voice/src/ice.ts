import { createHmac, randomBytes } from "node:crypto"
import { env } from "./env"

export type IceServerConfig = {
  urls: string | string[]
  username?: string
  credential?: string
}

type TurnSettings = {
  urls: string[]
  staticSecret: string | null
  username: string | null
  password: string | null
  ttlSeconds: number
}

function listFromEnv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function substituteAuto(url: string): string {
  return url.replace(/\bauto\b/g, env.mediasoup.announcedIp)
}

const stunUrls = listFromEnv(process.env.STUN_URL ?? "stun:stun.l.google.com:19302").map(substituteAuto)

const turnSettings: TurnSettings = {
  urls: listFromEnv(process.env.TURN_URL).map(substituteAuto),
  staticSecret: process.env.TURN_STATIC_SECRET || null,
  username: process.env.TURN_USERNAME || null,
  password: process.env.TURN_PASSWORD || null,
  ttlSeconds: Number(process.env.TURN_TTL_SECONDS ?? 3600)
}

function buildTurnCredentials(): { username: string; credential: string } | null {
  if (turnSettings.staticSecret) {
    const expiry = Math.floor(Date.now() / 1000) + turnSettings.ttlSeconds
    const salt = randomBytes(4).toString("hex")
    const username = `${expiry}:${salt}`
    const credential = createHmac("sha1", turnSettings.staticSecret).update(username).digest("base64")
    return { username, credential }
  }
  if (turnSettings.username && turnSettings.password) {
    return { username: turnSettings.username, credential: turnSettings.password }
  }
  return null
}

export function buildIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = []
  if (stunUrls.length > 0) servers.push({ urls: stunUrls })
  if (turnSettings.urls.length > 0) {
    const creds = buildTurnCredentials()
    if (creds) {
      servers.push({ urls: turnSettings.urls, ...creds })
    }
  }
  return servers
}
