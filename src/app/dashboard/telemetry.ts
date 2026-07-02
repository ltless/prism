"use server";

import { auth } from "@/auth";
import { getSystemStats } from "@/core/utils/system";

export async function getSystemStatsAction() {
 // Lock down telemetry endpoint so only authed accounts can inspect host metrics
 const session = await auth();
 if (!session?.user?.id) throw new Error("Unauthorized");

 return getSystemStats();
}
