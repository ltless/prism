"use client";

interface RulerProps {
  orientation: "horizontal" | "vertical";
  visible: boolean;
}

const RULER_LENGTH = 2000;
const RULER_STEP = 50;

// One mark per step; major marks (every 100px) also get a numeric label.
function rulerMarks(isHorizontal: boolean) {
  const marks = [];
  for (let i = 0; i <= RULER_LENGTH; i += RULER_STEP) {
    const isMajor = i % 100 === 0;
    marks.push(
      <div
        key={i}
        style={isHorizontal ? { left: `${i}px` } : { top: `${i}px` }}
        className={`absolute ${isHorizontal ? "bottom-0 w-px" : "right-0 h-px"} ${
          isMajor ? (isHorizontal ? "h-2" : "w-2") : (isHorizontal ? "h-1" : "w-1")
        } bg-white/35`}
      />
    );
    if (isMajor) {
      marks.push(
        <span
          key={`label-${i}`}
          style={isHorizontal ? { left: `${i + 2}px` } : { top: `${i + 2}px` }}
          className={`absolute text-[11px] text-white/45 font-mono ${
            isHorizontal ? "top-0.5" : "left-0.5 [writing-mode:vertical-lr]"
          }`}
        >
          {i}
        </span>
      );
    }
  }
  return marks;
}

export function Ruler({ orientation, visible }: RulerProps) {
  if (!visible) return null;

  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={`relative bg-white/4 text-white/45 border-white/10 shrink-0 overflow-visible ${
        isHorizontal ? "h-5 border-b" : "w-5 border-r"
      }`}
    >
      {rulerMarks(isHorizontal)}
    </div>
  );
}
