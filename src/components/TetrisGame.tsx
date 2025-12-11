'use client';

import { useEffect, useMemo, useState } from "react";
import { useTetrisEngine, type ActivePiece } from "@/hooks/useTetrisEngine";
import {
  BOARD_HEIGHT,
  TETROMINOES,
  type TetrominoType,
  VISIBLE_HEIGHT,
} from "@/lib/tetrominoes";

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const getBlocks = (piece: ActivePiece) => {
  const definition = TETROMINOES[piece.type];
  const rotation = definition.rotations[piece.rotation];
  return rotation.map((block) => ({
    x: block.x + piece.position.x,
    y: block.y + piece.position.y,
  }));
};

const visibleStart = BOARD_HEIGHT - VISIBLE_HEIGHT;

const GradientBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-[40%] left-[10%] h-[75vmax] w-[75vmax] animate-[spin_40s_linear_infinite] rounded-full bg-[conic-gradient(at_top,_#9333ea,_#2563eb,_#22d3ee,_#9333ea)] opacity-30 blur-3xl" />
    <div className="absolute -bottom-[35%] right-[5%] h-[65vmax] w-[65vmax] animate-[spin_55s_linear_reverse_infinite] rounded-full bg-[conic-gradient(at_bottom,_#22c55e,_#14b8a6,_#3b82f6,_#22c55e)] opacity-25 blur-3xl" />
  </div>
);

const PanelCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-4 shadow-xl backdrop-blur-xl">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
      {title}
    </h2>
    <div className="space-y-3">{children}</div>
  </div>
);

const StatTag = ({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) => (
  <div className="flex flex-col rounded-2xl bg-white/5 p-3">
    <span className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-slate-400">
      {label}
    </span>
    <span className={classNames("text-xl font-semibold text-white", accent)}>
      {value}
    </span>
  </div>
);

const ControlLegend = () => (
  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
    {[
      ["← / →", "Move"],
      ["↑ / X", "Rotate CW"],
      ["Z", "Rotate CCW"],
      ["A / S", "Rotate 180°"],
      ["↓", "Soft Drop"],
      ["Space", "Hard Drop"],
      ["Shift / C", "Hold"],
      ["P", "Pause"],
      ["Enter", "Quick Start"],
    ].map(([key, action]) => (
      <div
        key={key}
        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 backdrop-blur-md"
      >
        <span className="font-semibold text-white">{key}</span>
        <span>{action}</span>
      </div>
    ))}
  </div>
);

const MiniMatrix = ({
  type,
  label,
}: {
  type: TetrominoType | null;
  label?: string;
}) => {
  const cells = useMemo(() => {
    if (!type) {
      return Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => null as TetrominoType | null),
      );
    }
    const rotation = TETROMINOES[type].rotations[0];
    const minX = Math.min(...rotation.map((cell) => cell.x));
    const minY = Math.min(...rotation.map((cell) => cell.y));
    const adjusted = rotation.map((cell) => ({
      x: cell.x - minX,
      y: cell.y - minY,
    }));
    const matrix = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => null as TetrominoType | null),
    );
    adjusted.forEach((cell) => {
      const x = Math.min(3, Math.max(0, cell.x));
      const y = Math.min(3, Math.max(0, cell.y));
      matrix[y]![x] = type;
    });
    return matrix;
  }, [type]);

  return (
    <div className="space-y-2">
      {label ? (
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
          {label}
        </div>
      ) : null}
      <div className="grid grid-cols-4 grid-rows-4 gap-[3px] rounded-2xl border border-white/10 bg-slate-900/50 p-2 shadow-inner">
        {cells.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const definition = cell ? TETROMINOES[cell] : null;
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={classNames(
                  "aspect-square rounded-lg border border-white/5 bg-slate-800/40 transition-all",
                  definition?.color,
                  definition ? "shadow-lg" : "",
                )}
              />
            );
          }),
        )}
      </div>
    </div>
  );
};

export const TetrisGame = () => {
  const {
    board,
    active,
    ghost,
    queue,
    hold,
    canHold,
    status,
    metrics,
    lastClear,
    linesJustCleared,
    achievements,
    highScore,
    actions: {
      moveLeft,
      moveRight,
      rotateCW,
      rotateCCW,
      rotate180,
      softDrop,
      hardDrop,
      hold: holdPiece,
      start,
      reset,
      pause,
      resume,
    },
  } = useTetrisEngine();

  const [celebration, setCelebration] = useState<string | null>(null);
  const [clearedRows, setClearedRows] = useState<number[]>([]);

  useEffect(() => {
    if (achievements.length === 0) {
      return;
    }
    let hideTimeout: number | undefined;
    const showTimeout = window.setTimeout(() => {
      setCelebration(achievements[0]!);
      hideTimeout = window.setTimeout(() => setCelebration(null), 2400);
    }, 40);
    return () => {
      window.clearTimeout(showTimeout);
      if (hideTimeout) {
        window.clearTimeout(hideTimeout);
      }
    };
  }, [achievements]);

  useEffect(() => {
    if (!linesJustCleared || linesJustCleared.length === 0) {
      const raf = window.requestAnimationFrame(() => {
        setClearedRows([]);
      });
      return () => window.cancelAnimationFrame(raf);
    }
    const translated = linesJustCleared
      .map((line) => line - visibleStart)
      .filter((index) => index >= 0 && index < VISIBLE_HEIGHT);
    const raf = window.requestAnimationFrame(() => {
      setClearedRows(translated);
    });
    const timeout = window.setTimeout(() => setClearedRows([]), 320);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [linesJustCleared]);

  const ghostSet = useMemo(() => {
    const set = new Set<string>();
    ghost.forEach((block) => {
      set.add(`${block.x}:${block.y}`);
    });
    return set;
  }, [ghost]);

  const activeSet = useMemo(() => {
    const set = new Set<string>();
    if (active) {
      getBlocks(active).forEach((block) => {
        set.add(`${block.x}:${block.y}`);
      });
    }
    return set;
  }, [active]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (status === "idle" && (event.code === "Enter" || event.code === "Space")) {
        event.preventDefault();
        start();
        return;
      }
      if (status === "over" && event.code === "Enter") {
        event.preventDefault();
        reset();
        return;
      }
      if (status === "paused" && event.code === "P") {
        event.preventDefault();
        resume();
        return;
      }

      if (status !== "running") {
        return;
      }

      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          moveLeft();
          break;
        case "ArrowRight":
          event.preventDefault();
          moveRight();
          break;
        case "ArrowDown":
          event.preventDefault();
          softDrop();
          break;
        case "ArrowUp":
        case "KeyX":
          event.preventDefault();
          rotateCW();
          break;
        case "KeyZ":
          event.preventDefault();
          rotateCCW();
          break;
        case "Space":
          event.preventDefault();
          hardDrop();
          break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight":
          event.preventDefault();
          holdPiece();
          break;
        case "KeyP":
          event.preventDefault();
          pause();
          break;
        case "KeyA":
        case "KeyS":
          event.preventDefault();
          rotate180();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    status,
    moveLeft,
    moveRight,
    softDrop,
    hardDrop,
    rotateCW,
    rotateCCW,
    rotate180,
    holdPiece,
    pause,
    resume,
    start,
    reset,
  ]);

  const renderedRows = useMemo(() => {
    return board.slice(visibleStart).map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => {
        const globalRow = rowIndex + visibleStart;
        const key = `${columnIndex}:${globalRow}`;
        const isActive = activeSet.has(key);
        const isGhost = ghostSet.has(key);
        const type = isActive ? active?.type : cell;
        const definition = type ? TETROMINOES[type] : null;
        const isCleared = clearedRows.includes(rowIndex);

        return {
          id: `${rowIndex}-${columnIndex}`,
          type,
          definition,
          isActive,
          isGhost,
          isFilled: Boolean(type),
          isCleared,
        };
      });
      return { id: rowIndex, cells };
    });
  }, [board, active?.type, activeSet, ghostSet, clearedRows]);

  const statusLabel = (() => {
    if (status === "running") return "LIVE";
    if (status === "paused") return "PAUSED";
    if (status === "over") return "GAME OVER";
    return "READY";
  })();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
      <GradientBackdrop />
      <div className="relative z-[1] flex w-full max-w-6xl flex-col gap-6 rounded-[40px] border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/60 backdrop-blur-2xl lg:flex-row lg:p-10">
        <div className="flex w-full flex-col gap-6 lg:max-w-[260px]">
          <PanelCard title="Game Status">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm uppercase tracking-[0.4em]">
              <span className="text-slate-300">Mode</span>
              <span
                className={classNames(
                  "font-semibold",
                  status === "running"
                    ? "text-emerald-400"
                    : status === "paused"
                      ? "text-amber-300"
                      : status === "over"
                        ? "text-rose-400"
                        : "text-sky-300",
                )}
              >
                {statusLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatTag label="Score" value={metrics.score.toLocaleString()} />
              <StatTag label="High Score" value={highScore.toLocaleString()} accent="text-emerald-300" />
              <StatTag label="Level" value={metrics.level} accent="text-sky-300" />
              <StatTag label="Lines" value={metrics.lines} accent="text-fuchsia-300" />
              <StatTag label="Combo" value={metrics.combo} accent="text-amber-300" />
              <StatTag label="Max Combo" value={metrics.maxCombo} accent="text-purple-300" />
              <StatTag label="Back-to-Back" value={metrics.backToBack} accent="text-cyan-300" />
              <StatTag label="Pieces" value={metrics.totalPieces} accent="text-lime-300" />
            </div>
            {lastClear ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 px-4 py-3 text-sm uppercase tracking-[0.4em] text-slate-300">
                Last Clear · {lastClear.toUpperCase()}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm uppercase tracking-[0.4em] text-slate-500">
                Awaiting first clear
              </div>
            )}
          </PanelCard>

          <PanelCard title="Hold">
            <MiniMatrix type={hold} />
            <div
              className={classNames(
                "rounded-2xl border px-4 py-3 text-sm uppercase tracking-[0.4em]",
                canHold
                  ? "border-emerald-400/40 text-emerald-200"
                  : "border-white/10 text-slate-500",
              )}
            >
              {canHold ? "Ready" : "Locked"}
            </div>
          </PanelCard>

          <PanelCard title="Next Queue">
            <div className="grid gap-3">
              {queue.slice(0, 5).map((type, index) => (
                <MiniMatrix key={`${type}-${index}`} type={type} label={`+${index + 1}`} />
              ))}
            </div>
          </PanelCard>
        </div>

        <div className="relative flex-1">
          <div className="relative mx-auto flex max-w-[420px] flex-col items-center">
            <div className="mb-4 flex w-full items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
              <span>Neo Tetris Engine</span>
              <span>Speed {Math.max(1, 11 - metrics.level)}</span>
            </div>
            <div className="relative aspect-[10/20] w-full overflow-hidden rounded-[26px] border border-white/15 bg-slate-950/70 p-3 shadow-[0_40px_120px_rgba(15,23,42,0.7)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent)]" />
              <div className="relative z-[1] grid h-full grid-cols-10 gap-[3px]">
                {renderedRows.flatMap((row) =>
                  row.cells.map((cell) => (
                    <div
                      key={cell.id}
                      className={classNames(
                        "relative rounded-md border border-white/5 bg-slate-800/40 transition-all duration-150 ease-out",
                        cell.definition?.color,
                        cell.isGhost
                          ? "border-dashed border-white/30 bg-white/10"
                          : "",
                        cell.isActive ? "scale-[1.04]" : "",
                        cell.isFilled ? cell.definition?.accent : "",
                        cell.isCleared
                          ? "animate-[pulse_0.35s_ease-in-out]"
                          : "",
                      )}
                    >
                      <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-br from-white/15 to-transparent opacity-50" />
                    </div>
                  )),
                )}
              </div>

              {(status === "idle" || status === "paused" || status === "over") && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
                  <div className="w-full max-w-xs rounded-3xl border border-white/10 bg-black/70 p-6 text-center shadow-2xl">
                    <p className="mb-2 text-xs uppercase tracking-[0.4em] text-slate-400">
                      {status === "idle"
                        ? "Ready for takeoff"
                        : status === "paused"
                          ? "Flight paused"
                          : "Mission complete"}
                    </p>
                    <h3 className="mb-6 text-2xl font-semibold text-white">
                      {status === "idle"
                        ? "Start a brand-new run."
                        : status === "paused"
                          ? "Resume when ready."
                          : "You crushed it!"}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {status === "idle" || status === "over" ? (
                        <button
                          onClick={status === "over" ? reset : start}
                          className="rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02]"
                        >
                          {status === "over" ? "Play Again" : "Start Game"}
                        </button>
                      ) : null}
                      {status === "paused" ? (
                        <button
                          onClick={resume}
                          className="rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-purple-500/30 transition hover:scale-[1.02]"
                        >
                          Resume
                        </button>
                      ) : null}
                      {status !== "idle" && (
                        <button
                          onClick={reset}
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:bg-white/10"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/40 px-4 py-2 text-xs uppercase tracking-[0.4em] text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
              <span>Quantum Drop Engine Online</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-6 lg:max-w-[260px]">
          <PanelCard title="Control Lab">
            <ControlLegend />
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 text-xs text-slate-300">
              <p className="mb-2 font-semibold text-white">Smart Auto-Leveling</p>
              <p>
                Game speed adapts to your line clears with combo boosts, back-to-back
                multipliers, and T-Spin recognition to reward aggressive play.
              </p>
            </div>
          </PanelCard>

          <PanelCard title="Performance Feed">
            <div className="space-y-2 text-xs text-slate-300">
              <p>
                <span className="font-semibold text-white">Drop Distance:</span>{" "}
                {metrics.dropDistance.toLocaleString()} cells traveled
              </p>
              <p>
                <span className="font-semibold text-white">Combo Booster:</span>{" "}
                {metrics.combo >= 2
                  ? `ON x${metrics.combo}`
                  : "Charge combos to activate"}
              </p>
              <p>
                <span className="font-semibold text-white">Back-to-Back Chain:</span>{" "}
                {metrics.backToBack > 0 ? `${metrics.backToBack} streak` : "Chain ready"}
              </p>
              <p>
                <span className="font-semibold text-white">Pieces Deployed:</span>{" "}
                {metrics.totalPieces}
              </p>
              <p>
                <span className="font-semibold text-white">Engine Status:</span>{" "}
                {status === "running"
                  ? "Stabilized"
                  : status === "paused"
                    ? "Holding"
                    : status === "over"
                      ? "Cooldown"
                      : "Standby"}
              </p>
            </div>
          </PanelCard>

          <PanelCard title="Daily Briefing">
            <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 text-xs text-sky-100">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em]">
                Ultra Challenge
              </p>
              <p>
                Hit a combo of 5+ and clear 4 lines in a single drop to unlock the{" "}
                <span className="font-semibold text-white">Skyfall</span> badge.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200">
              <p className="mb-1 font-semibold uppercase tracking-[0.3em] text-white">
                Leader Insight
              </p>
              <p>
                Average pro clear pace: <span className="font-semibold">4.2</span>{" "}
                lines / 60s. Maintain combos to beat the leaderboard projections.
              </p>
            </div>
          </PanelCard>
        </div>
      </div>

      {celebration ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-[5] flex justify-center">
          <div className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-emerald-200 shadow-[0_0_32px_rgba(16,185,129,0.5)]">
            Achievement Unlocked · {celebration}
          </div>
        </div>
      ) : null}
    </div>
  );
};
