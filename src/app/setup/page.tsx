import { SetupWizard } from "@/features/onboarding/components/SetupWizard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/services/db";
import { users } from "@/services/db/schema";
import { eq } from "drizzle-orm";

export default async function SetupPage() {
 const session = await auth();
 if (!session?.user?.id) redirect("/login");

 // Double check if they actually need setup
 const [userRecord] = await db.select().from(users).where(eq(users.id, session.user.id));
 if (userRecord?.hasCompletedSetup) {
 redirect("/dashboard");
 }

 return <SetupWizard />;
}
