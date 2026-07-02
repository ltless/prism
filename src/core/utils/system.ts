import os from "os";

export interface SystemStats {
 cpu: number;
 ram: number;
 ramText: string;
}

export function getSystemStats(): SystemStats {
 const cpuCount = os.cpus().length;
 const cpuUsage = Math.min(Math.round((os.loadavg()[0] / cpuCount) * 100), 100);

 const totalMem = os.totalmem();
 const usedMem = totalMem - os.freemem();

 return {
 cpu: cpuUsage,
 ram: Math.round((usedMem / totalMem) * 100),
 ramText: `${(usedMem / 1073741824).toFixed(1)}/${(totalMem / 1073741824).toFixed(0)}GB`
 };
}
