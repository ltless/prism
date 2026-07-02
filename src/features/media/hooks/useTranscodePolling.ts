import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function useTranscodePolling(
  itemId: string,
  transcodeStatus: string | null | undefined,
  isVideo: boolean,
  onStatusChange: (status: string) => void,
) {
  const router = useRouter();

  useQuery({
    queryKey: ["transcode", itemId],
    queryFn: async () => {
      const res = await fetch("/api/v1/media/batch/transcode-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [itemId] }),
      });
      if (!res.ok) throw new Error("transcode status fetch failed");
      return res.json();
    },
    enabled: isVideo && (transcodeStatus === "pending" || transcodeStatus === "processing"),
    refetchInterval: (query) => {
      const status = query.state.data?.statuses?.[itemId]?.status;
      if (status === "done" || status === "failed") {
        onStatusChange(status);
        router.refresh();
        return false;
      }
      return 3000;
    },
  });
}
