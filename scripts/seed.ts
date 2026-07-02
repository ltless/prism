const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error("Usage: npx tsx scripts/seed.ts <username> <password>");
    process.exit(1);
  }

  const res = await fetch(`${GO_API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      invite_code: process.env.REGISTRATION_INVITE_CODE || "",
    }),
  });

  if (res.ok) {
    console.log(`User ${username} created successfully!`);
  } else {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    console.error(`Failed: ${(err as { error?: string }).error || res.status}`);
    process.exit(1);
  }
}

main();
