import { useEffect, useRef } from "react";
import type { NormalizedNote } from "./musicGardenMidi.js";
import "./MusicGarden.css";

// Notes scroll right→left across a horizontal strip at the bottom of the
// viewport, below characters (38–62% y) and below both HUD bars (top ~80px).
// Strip occupies 72%–90% of canvas height — clear of sprites and UI.
const SCROLL_DURATION_MS = 5500;  // ms to cross full canvas width
const LANE_TOP = 0.72;            // fraction of canvas height
const LANE_BOTTOM = 0.90;
const MAX_ACTIVE_VISUAL = 80;
const NOTE_RADIUS_BASE = 11;

interface Particle {
  id: string;
  y: number;         // fixed vertical position (canvas pixels)
  radius: number;
  hue: number;
  born: number;      // elapsedMs when particle was added
}

interface MusicGardenVisualizerProps {
  notes: NormalizedNote[];
  elapsedMs: number;
  dimmed: boolean;
  rewardsEnabled: boolean;
  onNoteClick: (noteId: string) => void;
  onNoteExpire: (noteId: string) => void;
}

function particleX(canvas: HTMLCanvasElement, born: number, elapsedMs: number): number {
  const scrolled = (elapsedMs - born) / SCROLL_DURATION_MS;
  return canvas.width * (1 - scrolled);
}

export function MusicGardenVisualizer({
  notes,
  elapsedMs,
  dimmed,
  rewardsEnabled,
  onNoteClick,
  onNoteExpire,
}: MusicGardenVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Map<string, Particle>>(new Map());
  const expiredRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const propsRef = useRef({ notes, elapsedMs, rewardsEnabled, onNoteClick, onNoteExpire });

  propsRef.current = { notes, elapsedMs, rewardsEnabled, onNoteClick, onNoteExpire };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      const { notes, elapsedMs, rewardsEnabled, onNoteExpire } = propsRef.current;
      const particles = particlesRef.current;
      const expired = expiredRef.current;

      // Spawn new active notes as scrolling particles
      for (const note of notes) {
        if (!note.active) continue;
        if (particles.has(note.id)) continue;
        if (expired.has(note.id)) continue;
        if (particles.size >= MAX_ACTIVE_VISUAL) break;

        // Pitch → vertical position within strip (higher pitch → higher in strip)
        const pitchFraction = (note.pitch - 21) / (108 - 21);
        const yFraction = LANE_BOTTOM - pitchFraction * (LANE_BOTTOM - LANE_TOP);
        const y = yFraction * canvas.height;

        // Slight pitch variation in radius for visual depth
        const radius = NOTE_RADIUS_BASE + (note.pitch % 7) * 0.6;

        particles.set(note.id, {
          id: note.id,
          y,
          radius,
          hue: (note.pitch * 13 + 180) % 360,
          born: elapsedMs,
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw scroll-lane guide line (subtle)
      const laneY = (LANE_TOP + LANE_BOTTOM) / 2 * canvas.height;
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#c8a8ff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(canvas.width, laneY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      for (const [id, p] of particles) {
        const x = particleX(canvas, p.born, elapsedMs);

        // Expired — exited left edge
        if (x < -p.radius * 2) {
          particles.delete(id);
          if (!expired.has(id)) {
            expired.add(id);
            const note = notes.find((n) => n.id === id);
            if (note && !note.clicked && rewardsEnabled) {
              onNoteExpire(id);
            }
          }
          continue;
        }

        // Fade in as note enters from right, fade out as it approaches left
        const scrollFraction = (elapsedMs - p.born) / SCROLL_DURATION_MS;
        const alphaIn = Math.min(1, (canvas.width - x) / (p.radius * 4));
        const alphaOut = Math.min(1, x / (p.radius * 4));
        const alpha = Math.min(alphaIn, alphaOut);

        ctx.save();
        ctx.globalAlpha = alpha * 0.88;

        // Glowing orb
        const grad = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.radius);
        grad.addColorStop(0, `hsl(${p.hue}, 90%, 92%)`);
        grad.addColorStop(0.5, `hsl(${p.hue}, 75%, 65%)`);
        grad.addColorStop(1, `hsla(${p.hue}, 60%, 45%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Trailing glow (direction: right side, since note moves left)
        const trailGrad = ctx.createLinearGradient(x, p.y, x + p.radius * 3, p.y);
        trailGrad.addColorStop(0, `hsla(${p.hue}, 80%, 70%, 0.35)`);
        trailGrad.addColorStop(1, `hsla(${p.hue}, 60%, 50%, 0)`);
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.ellipse(x + p.radius * 1.5, p.y, p.radius * 2.5, p.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        void scrollFraction;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { elapsedMs: currentMs, onNoteClick } = propsRef.current;

    for (const [id, p] of particlesRef.current) {
      const x = particleX(canvas, p.born, currentMs);
      const dx = mx - x;
      const dy = my - p.y;
      const hitRadius = p.radius + 14; // generous hit area
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        e.stopPropagation();
        onNoteClick(id);
        particlesRef.current.delete(id);
        expiredRef.current.add(id);
        break;
      }
    }
  }

  useEffect(() => {
    particlesRef.current.clear();
    expiredRef.current.clear();
  }, [notes]);

  return (
    <canvas
      ref={canvasRef}
      className={`music-garden-visualizer${dimmed ? " music-garden-visualizer--dimmed" : ""}`}
      onClick={handleCanvasClick}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
