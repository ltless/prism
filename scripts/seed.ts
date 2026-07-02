import { db } from "../src/services/db";
import { users } from "../src/services/db/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error("Usage: npx tsx scripts/seed.ts <username> <password> <role?>");
    process.exit(1);
  }

  const role = process.argv[4] || "user";

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role: role as "admin" | "user",
  });

  console.log(`User ${username} created successfully!`);
  process.exit(0);
}

main();
