"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { CanvasRendererHandle } from "../canvas/CanvasRenderer";
import { useEditorState } from "../../image-editor/state/editorState";
import { useEditorActions } from "../../image-editor/hooks/useEditorActions";

interface UseImageEditorUiArgs {
  canvasRef: React.RefObject<CanvasRendererHandle | null>;
  onSampleColor: (hex: string) => void;
}

/**
 * Editor UI-visibility state + transform commit handlers + eyedropper
 * mouse routing. Extracted from ImageEditor.tsx (F13) — pure move, no
 * behavior change.
 */
export function useImageEditorUi({ canvasRef, onSampleColor }: UseImageEditorUiArgs) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [sampledColor, setSampledColor] = useState<{
    r: number;
    g: number;
    b: number;
    a: number;
  } | null>(null);

  const activeTool = useEditorState((s) => s.activeTool);
  const setActiveTool = useEditorState((s) => s.setActiveTool);
  const setTransform = useEditorState((s) => s.setTransform);
  const resetAll = useEditorState((s) => s.resetAll);
  const { commitEdit } = useEditorActions();

  const handleRotationChange = useCallback(
    (value: number) => commitEdit(() => setTransform({ rotation: value })),
    [commitEdit, setTransform]
  );

  const handleFlipH = useCallback(
    () =>
      commitEdit(() =>
        setTransform({ flipH: !useEditorState.getState().flipH })
      ),
    [commitEdit, setTransform]
  );

  const handleFlipV = useCallback(
    () =>
      commitEdit(() =>
        setTransform({ flipV: !useEditorState.getState().flipV })
      ),
    [commitEdit, setTransform]
  );

  const commitResetAll = useCallback(() => {
    commitEdit(() => resetAll());
  }, [commitEdit, resetAll]);

  const handleAutoAdjustStub = useCallback(
    (name: "Auto Tone" | "Auto Contrast" | "Auto Color") => {
      toast(`${name} coming soon — not wired up yet`, {
        description: "Tweak the sliders by hand for now. Auto-detection is on the maybe-someday list.",
        duration: 2000,
      });
    },
    []
  );

  const handleSampledMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== "eyedropper") return false;
      const color = canvasRef.current?.sampleColor(e.clientX, e.clientY);
      if (color) {
        const hex = `#${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b.toString(16).padStart(2, "0")}`;
        setSampledColor(color);
        onSampleColor(hex);
        toast(`Sampled ${hex}`, {
          description: `R${color.r} G${color.g} B${color.b}`,
          duration: 1500,
        });
      }
      return true;
    },
    [activeTool, canvasRef, onSampleColor]
  );

  return {
    isLibraryOpen, setIsLibraryOpen,
    showRulers, setShowRulers,
    showGrid, setShowGrid,
    showSidebar, setShowSidebar,
    showBefore, setShowBefore,
    sampledColor, setSampledColor,
    activeTool, setActiveTool,
    handleRotationChange,
    handleFlipH,
    handleFlipV,
    commitResetAll,
    handleAutoAdjustStub,
    handleSampledMouseDown,
  };
}
