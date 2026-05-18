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
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET"),
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321"
}
