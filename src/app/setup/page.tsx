import { SetupWizard } from "@/features/onboarding/components/SetupWizard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Double check if they actually need setup — session already has this flag
  // from /auth/me via the Go backend.
  if (session.user.hasCompletedSetup) {
    redirect("/dashboard");
  }

  return <SetupWizard />;
}
