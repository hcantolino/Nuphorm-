import { useEffect, useRef } from "react";

/**
 * Full-viewport technical circuit-board canvas background.
 * Used by /login and /signup pages.
 */
export default function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw(canvas, w, h, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ── Seeded random for deterministic layout ── */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function draw(canvas: HTMLCanvasElement, W: number, H: number, dpr: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Gradient background ──
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#dce8f3");
  grad.addColorStop(0.5, "#e4eef7");
  grad.addColorStop(1, "#d8e4f0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Dot grid ──
  const dotSpacing = 28;
  ctx.fillStyle = "rgba(140, 175, 210, 0.45)";
  for (let x = 14; x < W; x += dotSpacing) {
    for (let y = 14; y < H; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const rand = seededRandom(42);

  // ── Circuit-trace connection lines ──
  ctx.strokeStyle = "rgba(100, 155, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const sx = rand() * W;
    const sy = rand() * H;
    const midX = sx + (rand() - 0.5) * 200;
    const endY = sy + (rand() - 0.5) * 200;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(midX, sy); // horizontal segment
    ctx.lineTo(midX, endY); // vertical segment
    ctx.stroke();

    // small node circle at endpoint
    ctx.fillStyle = "rgba(100, 155, 210, 0.3)";
    ctx.beginPath();
    ctx.arc(midX, endY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Decorative nodes (database, chart, document shapes) ──
  const nodeCount = 18;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < nodeCount; i++) {
    const nx = rand() * W;
    const ny = rand() * H;
    const type = Math.floor(rand() * 3);
    ctx.save();
    ctx.translate(nx, ny);

    if (type === 0) {
      // database icon
      ctx.strokeStyle = "rgba(40, 110, 195, 0.6)";
      ctx.fillStyle = "rgba(180, 210, 240, 0.7)";
      ctx.beginPath();
      ctx.ellipse(0, -6, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-8, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.lineTo(8, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI);
      ctx.stroke();
    } else if (type === 1) {
      // bar chart icon
      ctx.strokeStyle = "rgba(50, 130, 200, 0.65)";
      ctx.fillStyle = "rgba(50, 130, 200, 0.55)";
      ctx.fillRect(-8, -2, 4, 10);
      ctx.strokeRect(-8, -2, 4, 10);
      ctx.fillRect(-2, -8, 4, 16);
      ctx.strokeRect(-2, -8, 4, 16);
      ctx.fillRect(4, -5, 4, 13);
      ctx.strokeRect(4, -5, 4, 13);
    } else {
      // document icon
      ctx.strokeStyle = "rgba(40, 120, 195, 0.6)";
      ctx.fillStyle = "rgba(190, 215, 240, 0.7)";
      ctx.fillRect(-6, -8, 12, 16);
      ctx.strokeRect(-6, -8, 12, 16);
      ctx.strokeStyle = "rgba(40, 120, 195, 0.5)";
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(3, -3);
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.moveTo(-3, 3);
      ctx.lineTo(1, 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Watermark letters "N" and "U" ──
  ctx.fillStyle = "rgba(190, 210, 235, 0.45)";
  ctx.font = `bold ${Math.min(W * 0.25, 280)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", W * 0.32, H * 0.5);
  ctx.fillText("U", W * 0.72, H * 0.5);
}
