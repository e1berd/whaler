import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "@whaler/db/schema"
import { env } from "./env"

export const sql = postgres(env.databaseUrl, {
  max: 5,
  idle_timeout: 20
})

export const db = drizzle(sql, { schema })
