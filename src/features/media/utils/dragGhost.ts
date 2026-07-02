export const THUMB_URL = (filePath: string) => `/api/v1/media/files/${filePath}?thumb=1`;

const CARD_SIZE = 96;
const FAN_OFFSET = 10;
const STACK_OFFSET = 48;
const SINGLE_OFFSET = 32;

// Latest multi-selection is snapshotted here (by the grid) and read on demand
// (by the card that starts a drag), so selected thumb URLs never have to flow
// through per-card props.
let dragSelection: { ids: string[]; thumbs: string[] } = { ids: [], thumbs: [] };
export function setDragSelection(next: { ids: string[]; thumbs: string[] }) { dragSelection = next; }
export function getDragSelection() { return dragSelection; }

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

/** Single-item drag image: one card, no fan-out stack. */
export function buildSingleGhost(frontUrl: string): HTMLDivElement {
  const ghost = document.createElement("div");
  ghost.className = "w-16 h-16 rounded-xl border border-white/20 shadow-2xl overflow-hidden bg-black/40";
  const img = document.createElement("img");
  img.src = frontUrl;
  img.className = "w-full h-full object-cover opacity-80";
  ghost.appendChild(img);
  return ghost;
}

/**
 * Creates the drag-image ghost off-screen, hands it to the browser, and
 * removes it on the next tick — the DOM node is only needed for the
 * setDragImage snapshot.
 */
export function attachDragGhost(e: React.DragEvent, ghost: HTMLDivElement, offset: number) {
  ghost.style.position = "absolute";
  ghost.style.top = "-1000px";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, offset, offset);
  setTimeout(() => ghost.remove(), 0);
}

/** Builds the full drag payload + ghost for a card drag, single or stacked. */
export function startCardDrag(
  e: React.DragEvent,
  idsToMove: string[],
  imageUrl: string,
  selectedThumbs: string[],
) {
  e.dataTransfer.setData("application/prism-media-ids", JSON.stringify(idsToMove));
  e.dataTransfer.effectAllowed = "move";

  if (idsToMove.length > 1) {
    const others = selectedThumbs.filter(t => t !== imageUrl).slice(0, 2);
    attachDragGhost(e, buildDragStack(imageUrl, others, idsToMove.length), STACK_OFFSET);
  } else {
    attachDragGhost(e, buildSingleGhost(imageUrl), SINGLE_OFFSET);
  }
}
