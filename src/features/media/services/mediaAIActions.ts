"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";
import { auth } from "@/auth";

export async function batchTagMediaAction() {
 const session = await auth();
 if (!session?.user?.id) {
 throw new Error("Unauthorized");
 }

 return safeAction("BatchTagMedia", async () => {
   const result = await goFetch<{ tagged: number; remaining: number; done: boolean; error?: string }>(
     "/api/v1/media/batch/ai-tags", { method: "POST" }
   );
   revalidatePath("/dashboard");
   return result;
 });
}

export async function batchScoreAestheticsAction() {
 const session = await auth();
 if (!session?.user?.id) {
 throw new Error("Unauthorized");
 }

 return safeAction("BatchScoreAesthetics", async () => {
   const result = await goFetch<{ scored: number; remaining: number; done: boolean; error?: string }>(
     "/api/v1/media/batch/aesthetic-score", { method: "POST" }
   );
   revalidatePath("/dashboard");
   return result;
 });
}

export async function countTaggedMediaAction() {
  return safeAction("CountTaggedMedia", async () => {
    return goFetch<{ total: number; tagged: number }>("/api/v1/media/count/tagged");
  });
}

export async function countScoredMediaAction() {
  return safeAction("CountScoredMedia", async () => {
    return goFetch<{ total: number; scored: number }>("/api/v1/media/count/scored");
  });
}
