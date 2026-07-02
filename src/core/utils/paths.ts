import path from "path";

const ROOT = process.cwd();

export function getStorageRoot(): string {
	return path.join(ROOT, "storage");
}

export function getModelsDir(): string {
	return path.join(getStorageRoot(), "models");
}

export function getGlobalDbPath(): string {
	return path.join(ROOT, "prism.db");
}

export function getDrizzleDir(): string {
	return path.join(ROOT, "drizzle");
}
