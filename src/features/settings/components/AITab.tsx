"use client";

import type { AIState } from "@/features/ai/store";
import { AdminAITab } from "./AdminAITab";
import { UserAITab } from "./UserAITab";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";

export interface AITabProps {
	ai: AIState;
	tagStats: { total: number; tagged: number } | null;
	scoreStats: { total: number; scored: number } | null;
	onSetTagStats: (stats: { total: number; tagged: number }) => void;
	onSetScoreStats: (stats: { total: number; scored: number }) => void;
}

export function AITab(props: AITabProps) {
	const { session: effectiveSession } = useEffectiveSession();
	const isAdmin = effectiveSession?.user?.role === "admin";

	return isAdmin ? <AdminAITab {...props} /> : <UserAITab {...props} />;
}
