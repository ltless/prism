import { useCallback } from "react";
import { useEditorState } from "../state/editorState";
import { useEditorActions } from "../hooks/useEditorActions";

export function useColorSetters() {
  const { commitEdit, rawSetAdjustment, setColorField } = useEditorActions();

  const setInvert = useCallback((v: boolean) => commitEdit(() => rawSetAdjustment("invert", v)), [commitEdit, rawSetAdjustment]);

  const setDuotoneColorA = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.duotone;
    setColorField("duotone", { colorA: v, colorB: d?.colorB ?? '#ffffff' });
  }, [setColorField]);

  const setDuotoneColorB = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.duotone;
    setColorField("duotone", { colorA: d?.colorA ?? '#000000', colorB: v });
  }, [setColorField]);

  const setTritoneColorA = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: v, colorB: d?.colorB ?? '#808080', colorC: d?.colorC ?? '#ffffff' });
  }, [setColorField]);

  const setTritoneColorB = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: d?.colorA ?? '#000000', colorB: v, colorC: d?.colorC ?? '#ffffff' });
  }, [setColorField]);

  const setTritoneColorC = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#808080', colorC: v });
  }, [setColorField]);

  const setQuadtoneColorA = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: v, colorB: d?.colorB ?? '#404040', colorC: d?.colorC ?? '#bfbfbf', colorD: d?.colorD ?? '#ffffff' });
  }, [setColorField]);

  const setQuadtoneColorB = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: v, colorC: d?.colorC ?? '#bfbfbf', colorD: d?.colorD ?? '#ffffff' });
  }, [setColorField]);

  const setQuadtoneColorC = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#404040', colorC: v, colorD: d?.colorD ?? '#ffffff' });
  }, [setColorField]);

  const setQuadtoneColorD = useCallback((v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#404040', colorC: d?.colorC ?? '#bfbfbf', colorD: v });
  }, [setColorField]);

  return {
    setInvert,
    setDuotoneColorA, setDuotoneColorB,
    setTritoneColorA, setTritoneColorB, setTritoneColorC,
    setQuadtoneColorA, setQuadtoneColorB, setQuadtoneColorC, setQuadtoneColorD,
  };
}
