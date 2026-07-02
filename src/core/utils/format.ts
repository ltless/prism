export function formatBytes(bytes: number, decimals = 2): string {
 if (bytes === 0) return "0 Bytes";
 const k = 1024;
 const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

export function formatUptime(seconds: number): string {
 const days = Math.floor(seconds / 86400);
 const hours = Math.floor((seconds % 86400) / 3600);
 const mins = Math.floor((seconds % 3600) / 60);
 const parts: string[] = [];
 if (days > 0) parts.push(`${days}d`);
 if (hours > 0) parts.push(`${hours}h`);
 parts.push(`${mins}m`);
 return parts.join(" ");
}

export function formatDuration(totalSeconds: number): string {
 const minutes = Math.floor(totalSeconds / 60);
 const seconds = String(totalSeconds % 60).padStart(2, "0");
 return `${minutes}:${seconds}`;
}

