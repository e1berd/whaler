function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET"),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:5173",
  runnerInternalUrl: process.env.RUNNER_INTERNAL_URL ?? "http://localhost:3002",
  runnerInternalToken: process.env.RUNNER_INTERNAL_TOKEN ?? ""
}
