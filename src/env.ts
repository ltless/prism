function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env: ${name}`);
  return val;
}

export const env = {
  AUTH_SECRET: requireEnv("AUTH_SECRET"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  NODE_ENV: process.env.NODE_ENV ?? "production",
};
