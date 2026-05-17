function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.COLLAB_PORT ?? process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET")
}
