import React, { memo, useState, useEffect, useRef } from "react";

interface HistogramProps {
  mediaUrl: string;
}

export const Histogram = memo(function Histogram({ mediaUrl }: HistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [histogramData, setHistogramData] = useState<{
    r: number[];
    g: number[];
    b: number[];
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Downscale to 300px max for fast histogram — full-res is unnecessary
      const MAX = 300;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const r = new Array(256).fill(0);
      const g = new Array(256).fill(0);
      const b = new Array(256).fill(0);

      for (let i = 0; i < data.length; i += 4) {
        r[data[i]]++;
        g[data[i + 1]]++;
        b[data[i + 2]]++;
      }

      setHistogramData({ r, g, b });
    };
    img.src = mediaUrl;
  }, [mediaUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !histogramData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(
      ...histogramData.r.slice(1, 255),
      ...histogramData.g.slice(1, 255),
      ...histogramData.b.slice(1, 255)
    );

    const drawChannel = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        const y = height - (data[i] / maxVal) * height;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    ctx.globalCompositeOperation = "lighter";
    drawChannel(histogramData.r, "rgba(239, 68, 68, 0.4)");
    drawChannel(histogramData.g, "rgba(34, 197, 94, 0.4)");
    drawChannel(histogramData.b, "rgba(59, 130, 246, 0.4)");
  }, [histogramData]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={80}
      className="w-full rounded-md border border-main-border"
    />
  );
});
