export const GAME_UI = (title: string) => `import { useSdk } from "@kibo/sdk";
import { useFocusMode, useGameLoop, useGamepad, useKeys } from "@kibo/sdk/game";
import { Button } from "@kibo/sdk/ui/button";
import { useEffect, useRef, useState } from "react";

const SIZE = 200;
const PLAYER = 12;
const SPEED = 90;

type Point = { x: number; y: number };

const clamp = (v: number) => Math.min(SIZE - PLAYER, Math.max(0, v));
const randomTarget = (): Point => ({ x: clamp(Math.random() * SIZE), y: clamp(Math.random() * SIZE) });
const touches = (a: Point, b: Point) => Math.abs(a.x - b.x) < PLAYER && Math.abs(a.y - b.y) < PLAYER;

export function Component() {
  const sdk = useSdk();
  const keys = useKeys();
  const pad = useGamepad();
  const focus = useFocusMode();
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Point>({ x: SIZE / 2, y: SIZE / 2 });
  const target = useRef<Point>(randomTarget());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    sdk.data.get<number>("best").then((v) => setBest(typeof v === "number" ? v : 0));
  }, [sdk]);

  const { paused } = useGameLoop((dt) => {
    const dx = (keys.isDown("ArrowRight") ? 1 : 0) - (keys.isDown("ArrowLeft") ? 1 : 0) + (pad.axes[0] ?? 0);
    const dy = (keys.isDown("ArrowDown") ? 1 : 0) - (keys.isDown("ArrowUp") ? 1 : 0) + (pad.axes[1] ?? 0);
    player.current = { x: clamp(player.current.x + dx * SPEED * dt), y: clamp(player.current.y + dy * SPEED * dt) };
    if (touches(player.current, target.current)) {
      target.current = randomTarget();
      setScore((s) => s + 1);
    }
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(ctx.canvas);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = style.getPropertyValue("--color-muted-foreground") || "gray";
    ctx.fillRect(target.current.x, target.current.y, PLAYER, PLAYER);
    ctx.fillStyle = style.getPropertyValue("--color-foreground") || "black";
    ctx.fillRect(player.current.x, player.current.y, PLAYER, PLAYER);
  });

  useEffect(() => {
    if (score <= best) return;
    setBest(score);
    sdk.data.set("best", score).catch((e: unknown) => console.error("[${title}] best not saved", e));
  }, [sdk, score, best]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          Score {score} · Record {best}
          {paused ? " · En pause" : ""}
        </span>
        {focus.available && (
          <Button size="sm" variant="outline" onClick={focus.active ? focus.exit : focus.request}>
            {focus.active ? "Quitter le plein écran" : "Plein écran"}
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <canvas ref={canvas} width={SIZE} height={SIZE} aria-label="${title}" className="aspect-square max-h-full max-w-full rounded-md border" />
      </div>
    </div>
  );
}
`;
