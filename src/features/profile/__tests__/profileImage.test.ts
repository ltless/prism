import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileImageAction } from "../services/profileActions";

vi.mock("@/lib/api", () => ({
  goFetch: vi.fn(async () => ({})),
  goFetchUpload: vi.fn(async (_path: string, body: FormData) => {
    const file = body.get("file") as File;
    if (!/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|webm)$/i.test(file.name)) {
      throw new Error("file type not allowed");
    }
    const type = body.get("type");
    return { path: `.profile/profile_test0.${type === "image" ? "jpg" : "png"}` };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

function fileFrom(bytes: number[], name: string, type: string): File {
  return new File([Buffer.from(bytes)], name, { type });
}

describe("updateProfileImageAction", () => {
  it("uploads via the Go profile-image endpoint", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fileFrom(
        [0xff, 0xd8, 0xff, 0xe0, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        "photo.jpg",
        "image/jpeg"
      )
    );
    const result = await updateProfileImageAction(formData, "image");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.path).toMatch(/^\.profile\//);
    }
  });

  it("rejects a non-image disguised as image/jpeg", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fileFrom([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54], "evil.php", "image/jpeg")
    );
    const result = await updateProfileImageAction(formData, "image");
    expect(result.success).toBe(false);
  });

  it("rejects oversized files client-side (max 5MB)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fileFrom([0xff, 0xd8, 0xff], "big.jpg", "image/jpeg")
    );
    Object.defineProperty(formData.get("file") as File, "size", {
      value: 6 * 1024 * 1024,
    });
    const result = await updateProfileImageAction(formData, "image");
    expect(result.success).toBe(false);
  });
});
