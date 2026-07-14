import path from "path";

const ROOT = process.cwd();

export function getStorageRoot(): string {
	return path.join(ROOT, "storage");
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "postgresql://prism:prism_dev_2024@localhost:5432/prism";
}

// Kept for backward compat — drizzle migrations folder
export function getDrizzleDir(): string {
	return path.join(ROOT, "drizzle");
}
