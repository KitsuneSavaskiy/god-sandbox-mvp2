import { useEffect, useRef } from "react";
import type { NormalizedNote } from "./musicGardenMidi.js";
import "./MusicGarden.css";

const MAX_ACTIVE_VISUAL = 80;

interface Particle {
  id: string;
  x: number;
  y: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
  born: number;
  durationMs: number;
}

interface MusicGardenVisualizerProps {
  notes: NormalizedNote[];
  elapsedMs: number;
  dimmed: boolean;
  rewardsEnabled: boolean;
  onNoteClick: (noteId: string) => void;
  onNoteExpire: (noteId: string) => void;
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

      for (const note of notes) {
        if (!note.active) continue;
        if (particles.has(note.id)) continue;
        if (expired.has(note.id)) continue;
        if (particles.size >= MAX_ACTIVE_VISUAL) break;

        const xFraction = (note.pitch - 21) / (108 - 21); // A0–C8
        const x = (xFraction * 0.8 + 0.1) * canvas.width;
        const y = (1 - xFraction) * 0.7 * canvas.height + 0.1 * canvas.height;

        particles.set(note.id, {
          id: note.id,
          x,
          y,
          vy: -0.4 - Math.random() * 0.3,
          size: 8 + (note.pitch % 12) * 1.2,
          hue: (note.pitch * 11) % 360,
          alpha: 0.85,
          born: elapsedMs,
          durationMs: note.durationMs,
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const [id, p] of particles) {
        const age = elapsedMs - p.born;
        const lifeRatio = age / p.durationMs;

        if (lifeRatio > 1) {
          particles.delete(id);
          if (!expired.has(id)) {
            expired.add(id);
            const note = notes.find((n) => n.id === id);
            // Only fire expiry for unclicked notes and only while rewards are enabled.
            // When event window is open (rewardsEnabled=false) notes animate out without
            // becoming "missed" — the opportunity is suspended, not forfeited.
            if (note && !note.clicked && rewardsEnabled) {
              onNoteExpire(id);
            }
          }
          continue;
        }

        const alphaFade = lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;
        const alpha = p.alpha * alphaFade;

        p.y += p.vy;

        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `hsl(${p.hue}, 80%, 85%)`);
        grad.addColorStop(0.6, `hsl(${p.hue}, 70%, 60%)`);
        grad.addColorStop(1, `hsla(${p.hue}, 60%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
    const { onNoteClick } = propsRef.current;

    for (const [id, p] of particlesRef.current) {
      const dx = mx - p.x;
      const dy = my - p.y;
      if (dx * dx + dy * dy <= (p.size + 10) * (p.size + 10)) {
        // Stop propagation only when a note is actually hit so viewport
        // click handling continues to work for misses.
        e.stopPropagation();
        onNoteClick(id);
        particlesRef.current.delete(id);
        expiredRef.current.add(id);
        break;
      }
    }
  }

  // Reset particles when notes array changes (new file)
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
