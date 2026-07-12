import { useAIStore } from "@/features/ai/store";

describe("aiActive state", () => {
  beforeEach(() => {
    useAIStore.setState({ aiActive: false });
  });

  it("defaults to false", () => {
    expect(useAIStore.getState().aiActive).toBe(false);
  });

  it("setAiActive updates state", () => {
    useAIStore.getState().setAiActive(true);
    expect(useAIStore.getState().aiActive).toBe(true);
  });

  it("syncFromServer sets aiActive from server config", () => {
    useAIStore.getState().syncFromServer({
      isEnabled: false,
      userAIEnabled: false,
      aiActive: true,
      variant: "standard",
      aestheticModel: "clip",
      tagThreshold: 0.12,
      aestheticEnabled: false,
      autoFavoriteEnabled: false,
      autoFavoriteThreshold: 0.75,
      device: "gpu",
    });
    expect(useAIStore.getState().aiActive).toBe(true);
  });
});
