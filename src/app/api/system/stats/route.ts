import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getSystemStats } from "@/core/utils/system";
import { logger } from "@/core/utils/logger";

export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id || session.user.role !== "admin") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		return NextResponse.json(getSystemStats());
	} catch (error) {
		logger.error("Failed to get system stats", { error: String(error) });
		return NextResponse.json({ error: "Failed to get system stats" }, { status: 500 });
	}
}
