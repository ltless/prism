import { useQuery } from "@tanstack/react-query";

interface SystemStats {
	cpu: number;
	ram: number;
	ramText: string;
}

export function useSystemStats(enabled: boolean = true) {
	return useQuery<SystemStats>({
		queryKey: ["system-stats"],
		queryFn: async () => {
			const res = await fetch("/api/system/stats");
			if (!res.ok) throw new Error("stats fetch failed");
			return res.json();
		},
		enabled,
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
	}).data ?? { cpu: 0, ram: 0, ramText: "0/0GB" };
}
