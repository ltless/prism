"use client";

interface RulerProps {
  orientation: "horizontal" | "vertical";
  visible: boolean;
}

export function Ruler({ orientation, visible }: RulerProps) {
  if (!visible) return null;

  const isHorizontal = orientation === "horizontal";
  const length = 2000;
  const step = 50;

  const marks = [];
  for (let i = 0; i <= length; i += step) {
    const isMajor = i % 100 === 0;
    marks.push(
      <div
        key={i}
        style={isHorizontal ? { left: `${i}px` } : { top: `${i}px` }}
        className={`absolute ${isHorizontal ? "bottom-0" : "right-0"} ${
          isHorizontal ? "w-px" : "h-px"
        } ${isMajor ? (isHorizontal ? "h-2" : "w-2") : (isHorizontal ? "h-1" : "w-1")} bg-muted-text/40`}
      />
    );
    if (isMajor) {
      marks.push(
        <span
          key={`label-${i}`}
          style={isHorizontal ? { left: `${i + 2}px` } : { top: `${i + 2}px` }}
          className={`absolute text-[11px] text-muted-text/60 font-mono ${
            isHorizontal ? "top-0.5" : "left-0.5"
          } ${!isHorizontal ? "[writing-mode:vertical-lr]" : ""}`}
        >
          {i}
        </span>
      );
    }
  }

  return (
    <div
      className={`relative bg-surface-bg border-main-border shrink-0 overflow-visible ${
        isHorizontal ? "h-5 border-b" : "w-5 border-r"
      }`}
    >
      {marks}
    </div>
  );
}
