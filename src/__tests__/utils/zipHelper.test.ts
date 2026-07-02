import { describe, it, expect } from "vitest";
import { createZipArchive } from "../../features/media/utils/zipHelper";

describe("zipHelper", () => {
 it("should create a valid uncompressed zip archive blob", async () => {
 const encoder = new TextEncoder();
 const entries = [
 { filename: "test1.txt", data: encoder.encode("Hello World") },
 { filename: "test2.txt", data: encoder.encode("Vitest test") }
 ];

 const blob = createZipArchive(entries);
 expect(blob).toBeInstanceOf(Blob);
 expect(blob.type).toBe("application/zip");

 const arrayBuffer = await blob.arrayBuffer();
 const uint8 = new Uint8Array(arrayBuffer);

 // Check local file header signature for the first file (PK\x03\x04)
 expect(uint8[0]).toBe(0x50); // P
 expect(uint8[1]).toBe(0x4b); // K
 expect(uint8[2]).toBe(0x03);
 expect(uint8[3]).toBe(0x04);
 });
});
