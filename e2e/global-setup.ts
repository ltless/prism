const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

// completeSetup logs in as e2euser and marks setup complete so the
// "login -> dashboard" specs land on /dashboard instead of /setup (fresh DB).
async function completeSetup(password: string) {
  const login = await fetch(`${GO_API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "e2euser", password }),
  });
  const setCookie = login.headers.get("set-cookie");
  if (!setCookie) {
    console.warn("  e2euser login failed, setup not marked complete");
    return;
  }
  const token = setCookie.split(";")[0];
  await fetch(`${GO_API_URL}/api/v1/users/me/setup-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: token,
    },
    body: "{}",
  });
}

async function globalSetup() {
  // Register e2e user via Go API (handles user creation + dedup)
  const password = "testpass123";

  // Try to register — if user exists, login works anyway
  const res = await fetch(`${GO_API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "e2euser",
      password,
      invite_code: process.env.REGISTRATION_INVITE_CODE || "",
    }),
  });

  if (res.ok) {
    console.log("  Seeded e2euser");
  } else if (res.status === 409) {
    console.log("  e2euser already exists, skipping");
  } else {
    console.warn("  Failed to seed e2euser:", await res.text());
  }

  await completeSetup(password);
}

export default globalSetup;
