import { describe, it, expect } from "vitest";
import { toSafeMessage } from "@/core/utils/action";

// These tests verify that our code filters out sensitive system or database messages.
describe("toSafeMessage", () => {
 it("keeps normal user errors as-is", () => {
 expect(toSafeMessage("Username is already taken")).toBe("Username is already taken");
 expect(toSafeMessage(new Error("Invalid email address"))).toBe("Invalid email address");
 });

 it("filters PostgreSQL errors", () => {
 const err = new Error("Postgres error: relation users does not exist");
 expect(toSafeMessage(err)).toBe("An internal database or system error occurred");
 });

 it("filters Drizzle errors", () => {
 const err = "DrizzleError: query failed";
 expect(toSafeMessage(err)).toBe("An internal database or system error occurred");
 });

 it("filters filesystem and system errors", () => {
 const err = new Error("ENOENT: no such file or directory, open 'config.json'");
 expect(toSafeMessage(err)).toBe("An internal database or system error occurred");

 const err2 = new Error("ECONNREFUSED: connection refused");
 expect(toSafeMessage(err2)).toBe("An internal database or system error occurred");
 });

 it("filters raw stack details", () => {
 const rawStack = `Error: Something went wrong\n at Object.<anonymous> (f:\\Porto\\prism-next\\src\\core\\utils\\action.test.ts:1:1)`;
 expect(toSafeMessage(rawStack)).toBe("An internal database or system error occurred");
 });

 it("handles non-string/non-Error objects gracefully", () => {
 const err = { someKey: "pg_broken" };
 expect(toSafeMessage(err)).toBe("An internal database or system error occurred");

 const regularErrObj = { someKey: "harmless error message" };
 expect(toSafeMessage(regularErrObj)).toBe("An unexpected error occurred");
 });
});
