import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { FolderModal } from "../FolderModal";

const mockCreateFolderAction = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("../../services/mediaFolderActions", () => ({
  createFolderAction: (...args: unknown[]) => mockCreateFolderAction(...args),
}));

vi.mock("../../utils/smartCategories", () => ({
  SMART_CATEGORIES: ["people", "nature", "food", "animal", "building", "vehicle", "document", "indoor", "outdoor"],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/hooks/useFocusTrap", () => ({ useFocusTrap: vi.fn() }));
vi.mock("@/shared/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateFolderAction.mockResolvedValue({ success: true });
});

describe("FolderModal", () => {
  it("creates a regular folder by default", async () => {
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(<FolderModal onClose={onClose} />);

    fireEvent.change(getByLabelText("Folder Name"), { target: { value: "Vacation" } });
    fireEvent.click(getByLabelText("Color blue"));
    fireEvent.click(getByText("Create Folder"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockCreateFolderAction).toHaveBeenCalledWith("Vacation", "blue", undefined);
  });

  it("shows error when name empty", async () => {
    const onClose = vi.fn();
    const { getByText } = render(<FolderModal onClose={onClose} />);

    fireEvent.click(getByText("Create Folder"));
    expect(getByText("Folder name is required")).toBeTruthy();
    expect(mockCreateFolderAction).not.toHaveBeenCalled();
  });

  it("requires a category when smart mode on", async () => {
    const onClose = vi.fn();
    const { getByRole, getByText } = render(<FolderModal onClose={onClose} />);

    fireEvent.change(getByRole("textbox"), { target: { value: "Picks" } });
    fireEvent.click(getByRole("button", { name: /Smart Folder/i }));
    fireEvent.click(getByText("Create Smart Folder"));

    expect(getByText("Select at least one category")).toBeTruthy();
    expect(mockCreateFolderAction).not.toHaveBeenCalled();
  });

  it("creates a smart folder with selected categories", async () => {
    const onClose = vi.fn();
    const { getByRole, getByText, getAllByRole } = render(<FolderModal onClose={onClose} />);

    fireEvent.change(getByRole("textbox"), { target: { value: "Nature picks" } });
    fireEvent.click(getByRole("button", { name: /Smart Folder/i }));
    const catBtn = getAllByRole("button", { name: "nature" })[0];
    fireEvent.click(catBtn);
    fireEvent.click(getByText("Create Smart Folder"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockCreateFolderAction).toHaveBeenCalledWith(
      "Nature picks",
      "zinc",
      { categories: ["nature"], minScore: 0.6 },
    );
  });

  it("keeps folder regular when smart toggled on then off", async () => {
    const onClose = vi.fn();
    const { getByRole, getByText, getAllByRole } = render(<FolderModal onClose={onClose} />);

    fireEvent.change(getByRole("textbox"), { target: { value: "Mixed" } });
    const toggle = getByRole("button", { name: /Smart Folder/i });
    fireEvent.click(toggle);
    fireEvent.click(getAllByRole("button", { name: "food" })[0]);
    fireEvent.click(toggle);
    fireEvent.click(getByText("Create Folder"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockCreateFolderAction).toHaveBeenCalledWith("Mixed", "zinc", undefined);
  });
});
