import { useSdk } from "@kibo/sdk";
import { createAudio, useFocusMode, useGameLoop, useGamepad, useKeys } from "@kibo/sdk/game";
import { isEditableTarget } from "@kibo/sdk/key-guard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawGame } from "./draw";
import { fr } from "./fr";
import { dirFromKeys, dirFromPad, newGame, step, turn } from "./rules";
import { useBestScore } from "./use-best";
import { boardColors, useBoardSize } from "./use-board";

const GRID = { w: 20, h: 14 };
const STEP_EVERY = 8;
const START_BUTTONS = [0, 9];

type Phase = "ready" | "playing" | "paused" | "over";

const fresh = () => newGame(GRID.w, GRID.h, Math.random);

export function Snake() {
  const sdk = useSdk();
  const focus = useFocusMode();
  const keys = useKeys();
  const pad = useGamepad();
  const audio = useMemo(() => createAudio(sdk), [sdk]);
  const [gameId] = useState(() => crypto.randomUUID());
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const game = useRef(fresh());
  const ticks = useRef(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, offerBest] = useBestScore(sdk);

  useEffect(() => sdk.capability("fullscreen"), [sdk]);

  const redraw = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    drawGame(ctx, game.current, { width: el.width, height: el.height }, boardColors(el));
  }, []);
  useBoardSize(canvas, redraw);

  const toggle = useCallback(() => {
    if (phase === "over") {
      game.current = fresh();
      ticks.current = 0;
      setScore(0);
      redraw();
    }
    setPhase(phase === "playing" ? "paused" : "playing");
  }, [phase, redraw]);

  const latest = useRef({ toggle, focus });
  latest.current = { toggle, focus };
  const listening = useCallback(
    () => latest.current.focus.active || (root.current?.contains(document.activeElement) ?? false),
    [],
  );

  useGameLoop(
    () => {
      const dir = (listening() ? dirFromKeys(keys.isDown) : null) ?? dirFromPad(pad);
      if (dir) game.current = turn(game.current, dir);
      ticks.current += 1;
      if (ticks.current < STEP_EVERY) return;
      ticks.current = 0;
      const before = game.current;
      game.current = step(before, Math.random);
      if (game.current.score > before.score) {
        audio.beep(880, 60);
        setScore(game.current.score);
        offerBest(game.current.score);
      }
      if (!game.current.alive) setPhase("over");
      redraw();
    },
    { running: phase === "playing" },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isEditableTarget(e.target) || !listening()) return;
      const { toggle, focus } = latest.current;
      if (e.code === "Space") toggle();
      else if (e.code === "KeyF" && focus.available) (focus.active ? focus.exit : focus.request)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening]);

  const started = START_BUTTONS.some((b) => pad.buttons[b] === true);
  const wasStarted = useRef(false);
  useEffect(() => {
    if (started && !wasStarted.current) latest.current.toggle();
    wasStarted.current = started;
  }, [started]);

  const hint = {
    ready: focus.available ? `${fr.ready} · ${fr.fullscreenKey}` : fr.ready,
    paused: fr.paused,
    over: fr.over,
    playing: null,
  }[phase];

  return (
    <div
      ref={root}
      role="application"
      aria-label={fr.game}
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col gap-2 rounded-md p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <output aria-live="polite" className="block truncate text-xs text-muted-foreground tabular-nums">
        {hint ? `${fr.score(score, best)} · ${hint}` : fr.score(score, best)}
      </output>
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvas}
          role="img"
          aria-label={fr.board(score)}
          data-game-id={gameId}
          className="absolute inset-0 size-full"
        />
      </div>
    </div>
  );
}
