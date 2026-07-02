/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileImageAction } from "../services/profileActions";

const state = vi.hoisted(() => ({
  written: [] as { path: string; bytes: Buffer }[],
  mockDb: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: "test-user-id" }])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((_values: any) => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock("@/services/db", () => ({ db: state.mockDb }));
vi.mock("@/services/db/multitenant", () => ({
  getUserPaths: vi.fn(async () => ({ mediaDir: "/tmp/profile-test" })),
}));
vi.mock("fs/promises", () => {
  const mkdir = vi.fn(async () => undefined);
  const writeFile = vi.fn(async (p: string, bytes: Buffer) => {
    state.written.push({ path: p, bytes });
  });
  return { default: { mkdir, writeFile }, mkdir, writeFile };
});

beforeEach(() => {
  vi.clearAllMocks();
  state.written.length = 0;
});

function fileFrom(bytes: number[], name: string, type: string): File {
  return new File([Buffer.from(bytes)], name, { type });
}

describe("updateProfileImageAction magic-byte validation", () => {
  it("rejects a non-image disguised as image/jpeg and does not write", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fileFrom(
        [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54], // "<!DOCT"
        "evil.php",
        "image/jpeg"
      )
    );
    const result = await updateProfileImageAction(formData, "image");
    expect(result.success).toBe(false);
    expect(state.written).toHaveLength(0);
  });

  it("saves a real jpeg with a .jpg extension regardless of the client filename", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fileFrom(
        [0xff, 0xd8, 0xff, 0xe0, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        "photo.png",
        "image/png"
      )
    );
    const result = await updateProfileImageAction(formData, "image");
    expect(result.success).toBe(true);
    expect(state.written).toHaveLength(1);
    expect(state.written[0].path).toMatch(/\.jpg$/);
  });
});
