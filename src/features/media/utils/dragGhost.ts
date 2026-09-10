export const THUMB_URL = (filePath: string) => `/api/v1/media/files/${filePath}?thumb=1`;

const CARD_SIZE = 96;
const FAN_OFFSET = 10;

export function buildDragStack(frontUrl: string, otherUrls: string[], total: number): HTMLDivElement {
  const stackCount = Math.min(total, 3);
  const extra = total - stackCount;

  const stack = document.createElement("div");
  Object.assign(stack.style, {
    position: "relative",
    width: `${CARD_SIZE + FAN_OFFSET * 2}px`,
    height: `${CARD_SIZE + FAN_OFFSET * 2}px`,
  });

  for (let i = stackCount - 1; i >= 1; i--) {
    const back = document.createElement("div");
    Object.assign(back.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: `${CARD_SIZE}px`,
      height: `${CARD_SIZE}px`,
      transform: `translate(${i * FAN_OFFSET}px, ${i * FAN_OFFSET}px)`,
      borderRadius: "12px",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.2)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      backgroundColor: "rgba(0,0,0,0.4)",
    });
    const url = otherUrls[i - 1];
    if (url) {
      const img = document.createElement("img");
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", opacity: "0.8" });
      img.src = url;
      back.appendChild(img);
    }
    stack.appendChild(back);
  }

  const front = document.createElement("div");
  Object.assign(front.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: `${CARD_SIZE}px`,
    height: `${CARD_SIZE}px`,
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  });
  const frontImg = document.createElement("img");
  Object.assign(frontImg.style, { width: "100%", height: "100%", objectFit: "cover", opacity: "0.9" });
  frontImg.src = frontUrl;
  front.appendChild(frontImg);
  stack.appendChild(front);

  if (extra > 0) {
    const badge = document.createElement("div");
    Object.assign(badge.style, {
      position: "absolute",
      right: "8px",
      bottom: "8px",
      padding: "2px 8px",
      borderRadius: "9999px",
      backgroundColor: "rgb(var(--accent-rgb))",
      color: "var(--text-on-primary)",
      fontSize: "11px",
      fontWeight: "700",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.2)",
    });
    badge.textContent = `+${extra}`;
    stack.appendChild(badge);
  }

  return stack;
}
