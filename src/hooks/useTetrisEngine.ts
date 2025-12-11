'use client';

import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  TetrominoType,
  TETROMINOES,
  TETROMINO_TYPES,
  type Point,
} from "@/lib/tetrominoes";

type Cell = TetrominoType | null;

export type ActivePiece = {
  type: TetrominoType;
  rotation: number;
  position: Point;
  kicked?: boolean;
};

export type GameStatus = "idle" | "running" | "paused" | "over";

type ClearType = "single" | "double" | "triple" | "tetris" | "tspin" | null;

interface Metrics {
  score: number;
  level: number;
  lines: number;
  combo: number;
  maxCombo: number;
  backToBack: number;
  totalPieces: number;
  dropDistance: number;
}

interface EngineState {
  board: Cell[][];
  active: ActivePiece | null;
  queue: TetrominoType[];
  hold: TetrominoType | null;
  canHold: boolean;
  status: GameStatus;
  metrics: Metrics;
  lastClear: ClearType;
  linesJustCleared: number[];
  pendingAchievements: string[];
  unlockedAchievements: string[];
  highScore: number;
}

type EngineAction =
  | { type: "START" }
  | { type: "RESET" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "TICK" }
  | { type: "MOVE"; direction: -1 | 1 }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "ROTATE"; direction: "CW" | "CCW" | "180" }
  | { type: "HOLD" }
  | { type: "HYDRATE_HIGH_SCORE"; value: number }
  | { type: "APPLY_PENDING_ACHIEVEMENTS" };

const newRow = (): Cell[] => Array(BOARD_WIDTH).fill(null);

const createEmptyBoard = (): Cell[][] =>
  Array.from({ length: BOARD_HEIGHT }, () => newRow());

const shuffle = <T,>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const createBag = (): TetrominoType[] => shuffle([...TETROMINO_TYPES]);

const ensureQueue = (queue: TetrominoType[], min = 6): TetrominoType[] => {
  const filled = [...queue];
  while (filled.length < min) {
    filled.push(...createBag());
  }
  return filled;
};

const initialQueue = ensureQueue([]);

const INITIAL_STATE: EngineState = {
  board: createEmptyBoard(),
  active: null,
  queue: initialQueue,
  hold: null,
  canHold: true,
  status: "idle",
  metrics: {
    score: 0,
    level: 1,
    lines: 0,
    combo: 0,
    maxCombo: 0,
    backToBack: 0,
    totalPieces: 0,
    dropDistance: 0,
  },
  lastClear: null,
  linesJustCleared: [],
  pendingAchievements: [],
  unlockedAchievements: [],
  highScore: 0,
};

const JLSTZ_KICKS: Record<string, Point[]> = {
  "0>1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  "1>0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  "1>2": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  "2>1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  "2>3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  "3>2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  "3>0": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  "0>3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
};

const I_KICKS: Record<string, Point[]> = {
  "0>1": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ],
  "1>0": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
  ],
  "1>2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
  ],
  "2>1": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 },
  ],
  "2>3": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
  ],
  "3>2": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ],
  "3>0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 },
  ],
  "0>3": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
  ],
};

const getKickKey = (from: number, to: number) => `${from}>${to}`;

const getKickTests = (
  type: TetrominoType,
  from: number,
  to: number,
): Point[] => {
  if (type === "O") {
    return [{ x: 0, y: 0 }];
  }

  const key = getKickKey(from, to);
  if (type === "I") {
    return I_KICKS[key] ?? [{ x: 0, y: 0 }];
  }

  return JLSTZ_KICKS[key] ?? [{ x: 0, y: 0 }];
};

const getBlocks = (piece: ActivePiece): Point[] => {
  const definition = TETROMINOES[piece.type];
  const rotation = definition.rotations[piece.rotation];
  return rotation.map((block) => ({
    x: block.x + piece.position.x,
    y: block.y + piece.position.y,
  }));
};

const collides = (board: Cell[][], piece: ActivePiece): boolean => {
  const blocks = getBlocks(piece);
  return blocks.some((block) => {
    if (block.x < 0 || block.x >= BOARD_WIDTH) {
      return true;
    }
    if (block.y >= BOARD_HEIGHT) {
      return true;
    }
    if (block.y >= 0 && board[block.y]?.[block.x]) {
      return true;
    }
    return false;
  });
};

const spawnPiece = (state: EngineState): EngineState => {
  const queue = ensureQueue(state.queue);
  const [next, ...rest] = queue;
  const spawnPosition: Point = {
    x: Math.floor(BOARD_WIDTH / 2) - 1,
    y: 1,
  };
  const piece: ActivePiece = {
    type: next,
    rotation: 0,
    position: spawnPosition,
  };
  if (collides(state.board, piece)) {
    return {
      ...state,
      status: "over",
      active: null,
      queue: [next, ...rest],
      canHold: false,
    };
  }

  return {
    ...state,
    active: piece,
    queue: [...rest],
    canHold: true,
    metrics: {
      ...state.metrics,
      totalPieces: state.metrics.totalPieces + 1,
    },
  };
};

const mergePiece = (board: Cell[][], piece: ActivePiece): Cell[][] => {
  const newBoard = board.map((row) => [...row]);
  getBlocks(piece).forEach((block) => {
    if (block.y >= 0 && block.y < BOARD_HEIGHT) {
      newBoard[block.y]![block.x] = piece.type;
    }
  });
  return newBoard;
};

const clearLines = (board: Cell[][]) => {
  const rowsToClear: number[] = [];
  board.forEach((row, index) => {
    if (row.every((cell) => cell !== null)) {
      rowsToClear.push(index);
    }
  });

  if (rowsToClear.length === 0) {
    return { board, rowsCleared: 0, lines: [] as number[] };
  }

  const filtered = board.filter((_, index) => !rowsToClear.includes(index));
  while (filtered.length < BOARD_HEIGHT) {
    filtered.unshift(newRow());
  }

  return {
    board: filtered,
    rowsCleared: rowsToClear.length,
    lines: rowsToClear,
  };
};

const scoreForLines = (lines: number, level: number, tspin: boolean) => {
  if (lines === 0) {
    return 0;
  }

  if (tspin) {
    switch (lines) {
      case 1:
        return 800 * level;
      case 2:
        return 1200 * level;
      case 3:
        return 1600 * level;
      default:
        return 0;
    }
  }

  switch (lines) {
    case 1:
      return 100 * level;
    case 2:
      return 300 * level;
    case 3:
      return 500 * level;
    case 4:
      return 800 * level;
    default:
      return 0;
  }
};

const detectTSpin = (board: Cell[][], piece: ActivePiece, locked: boolean) => {
  if (piece.type !== "T" || !locked) {
    return false;
  }

  const corners = [
    { x: piece.position.x, y: piece.position.y },
    { x: piece.position.x + 2, y: piece.position.y },
    { x: piece.position.x, y: piece.position.y - 2 },
    { x: piece.position.x + 2, y: piece.position.y - 2 },
  ];

  let occupied = 0;
  corners.forEach((corner) => {
    const boardX = corner.x;
    const boardY = corner.y;
    const cell =
      boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH
        ? board[boardY]?.[boardX]
        : null;
    if (cell) {
      occupied += 1;
    }
  });

  return occupied >= 3;
};

const achievementDefinitions = [
  { id: "first-clear", label: "First Lines Cleared", condition: (metrics: Metrics) => metrics.lines >= 1 },
  { id: "combo-fever", label: "Combo Fever (5 chain)", condition: (metrics: Metrics) => metrics.maxCombo >= 5 },
  { id: "tetris-slayer", label: "Tetris Slayer (4 lines)", condition: (_metrics: Metrics, lastClear: ClearType) => lastClear === "tetris" },
  { id: "marathoner", label: "Marathoner (40 lines)", condition: (metrics: Metrics) => metrics.lines >= 40 },
  { id: "sky-high", label: "Score 50k", condition: (metrics: Metrics) => metrics.score >= 50000 },
];

const applyAchievements = (state: EngineState): EngineState => {
  const newlyUnlocked = achievementDefinitions
    .filter(
      (achievement) =>
        !state.unlockedAchievements.includes(achievement.id) &&
        achievement.condition(state.metrics, state.lastClear),
    )
    .map((achievement) => achievement.label);

  if (newlyUnlocked.length === 0) {
    return state;
  }

  return {
    ...state,
    unlockedAchievements: [
      ...state.unlockedAchievements,
      ...achievementDefinitions
        .filter((achievement) =>
          newlyUnlocked.includes(achievement.label),
        )
        .map((achievement) => achievement.id),
    ],
    pendingAchievements: newlyUnlocked,
  };
};

const getDropDistance = (board: Cell[][], piece: ActivePiece): number => {
  let distance = 0;
  let testPiece = { ...piece, position: { ...piece.position } };

  while (true) {
    testPiece = {
      ...testPiece,
      position: { x: testPiece.position.x, y: testPiece.position.y + 1 },
    };
    if (collides(board, testPiece)) {
      break;
    }
    distance += 1;
  }

  return distance;
};

const getGhostBlocks = (board: Cell[][], piece: ActivePiece): Point[] => {
  const distance = getDropDistance(board, piece);
  return getBlocks({
    ...piece,
    position: {
      x: piece.position.x,
      y: piece.position.y + distance,
    },
  });
};

const reducer = (state: EngineState, action: EngineAction): EngineState => {
  switch (action.type) {
    case "HYDRATE_HIGH_SCORE":
      return { ...state, highScore: action.value };

    case "START":
      if (state.status === "running") {
        return state;
      }
      return spawnPiece({
        ...INITIAL_STATE,
        board: createEmptyBoard(),
        queue: ensureQueue([]),
        status: "running",
        highScore: state.highScore,
      });

    case "RESET":
      return spawnPiece({
        ...INITIAL_STATE,
        status: "running",
        highScore: state.highScore,
      });

    case "PAUSE":
      if (state.status !== "running") {
        return state;
      }
      return { ...state, status: "paused" };

    case "RESUME":
      if (state.status !== "paused") {
        return state;
      }
      return { ...state, status: "running" };

    case "MOVE": {
      if (state.status !== "running" || !state.active) {
        return state;
      }
      const candidate: ActivePiece = {
        ...state.active,
        position: {
          x: state.active.position.x + action.direction,
          y: state.active.position.y,
        },
      };
      if (collides(state.board, candidate)) {
        return state;
      }
      return { ...state, active: candidate };
    }

    case "SOFT_DROP": {
      if (state.status !== "running" || !state.active) {
        return state;
      }
      const candidate: ActivePiece = {
        ...state.active,
        position: {
          x: state.active.position.x,
          y: state.active.position.y + 1,
        },
      };

      if (collides(state.board, candidate)) {
        const lockedBoard = mergePiece(state.board, state.active);
        const tspin = detectTSpin(state.board, state.active, true);
        const { board: clearedBoard, rowsCleared, lines } = clearLines(lockedBoard);
        const clearType: ClearType =
          rowsCleared === 1
            ? tspin
              ? "tspin"
              : "single"
            : rowsCleared === 2
              ? tspin
                ? "tspin"
                : "double"
              : rowsCleared === 3
                ? tspin
                  ? "tspin"
                  : "triple"
                : rowsCleared === 4
                  ? "tetris"
                  : tspin
                    ? "tspin"
                    : null;

        const newCombo = rowsCleared > 0 ? state.metrics.combo + 1 : 0;
        const newBackToBack =
          rowsCleared >= 4 || tspin
            ? state.metrics.backToBack + 1
            : rowsCleared === 0
              ? state.metrics.backToBack
              : 0;

        const comboBonus =
          rowsCleared > 0 ? Math.max(0, newCombo - 1) * 50 * state.metrics.level : 0;
        const baseScore =
          scoreForLines(rowsCleared, state.metrics.level, tspin) + comboBonus;
        const backToBackBonus =
          (rowsCleared >= 4 || tspin) && state.metrics.backToBack > 0
            ? Math.floor(baseScore * 0.5)
            : 0;

        const updatedMetrics: Metrics = {
          ...state.metrics,
          score:
            state.metrics.score +
            baseScore +
            backToBackBonus +
            state.metrics.level, // soft drop bonus
          lines: state.metrics.lines + rowsCleared,
          combo: newCombo,
          maxCombo: Math.max(state.metrics.maxCombo, newCombo),
          backToBack: newBackToBack,
          dropDistance: state.metrics.dropDistance + 1,
        };
        const level = Math.min(20, Math.floor(updatedMetrics.lines / 10) + 1);
        const updated = applyAchievements({
          ...state,
          board: clearedBoard,
          active: null,
          queue: ensureQueue(state.queue),
          canHold: true,
          metrics: { ...updatedMetrics, level },
          lastClear: clearType,
          linesJustCleared: lines,
        });
        return spawnPiece(updated);
      }

      return {
        ...state,
        active: candidate,
        metrics: {
          ...state.metrics,
          score: state.metrics.score + state.metrics.level,
          dropDistance: state.metrics.dropDistance + 1,
        },
      };
    }

    case "HARD_DROP": {
      if (state.status !== "running" || !state.active) {
        return state;
      }
      const distance = getDropDistance(state.board, state.active);
      if (distance === 0) {
        return state;
      }
      const droppedPiece: ActivePiece = {
        ...state.active,
        position: {
          x: state.active.position.x,
          y: state.active.position.y + distance,
        },
      };
      const lockedBoard = mergePiece(state.board, droppedPiece);
      const tspin = detectTSpin(state.board, droppedPiece, true);
      const { board: clearedBoard, rowsCleared, lines } = clearLines(lockedBoard);

      const clearType: ClearType =
        rowsCleared === 1
          ? tspin
            ? "tspin"
            : "single"
          : rowsCleared === 2
            ? tspin
              ? "tspin"
              : "double"
            : rowsCleared === 3
              ? tspin
                ? "tspin"
                : "triple"
              : rowsCleared === 4
                ? "tetris"
                : tspin
                  ? "tspin"
                  : null;

      const newCombo = rowsCleared > 0 ? state.metrics.combo + 1 : 0;
      const newBackToBack =
        rowsCleared >= 4 || tspin
          ? state.metrics.backToBack + 1
          : rowsCleared === 0
            ? state.metrics.backToBack
            : 0;

      const comboBonus =
        rowsCleared > 0 ? Math.max(0, newCombo - 1) * 50 * state.metrics.level : 0;
      const baseScore =
        scoreForLines(rowsCleared, state.metrics.level, tspin) + comboBonus;
      const backToBackBonus =
        (rowsCleared >= 4 || tspin) && state.metrics.backToBack > 0
          ? Math.floor(baseScore * 0.5)
          : 0;
      const hardDropScore = distance * 2 * state.metrics.level;

      const updatedMetrics: Metrics = {
        ...state.metrics,
        score:
          state.metrics.score +
          baseScore +
          backToBackBonus +
          hardDropScore,
        lines: state.metrics.lines + rowsCleared,
        combo: newCombo,
        maxCombo: Math.max(state.metrics.maxCombo, newCombo),
        backToBack: newBackToBack,
        dropDistance: state.metrics.dropDistance + distance,
      };
      const level = Math.min(20, Math.floor(updatedMetrics.lines / 10) + 1);
      const updated = applyAchievements({
        ...state,
        board: clearedBoard,
        active: null,
        queue: ensureQueue(state.queue),
        canHold: true,
        metrics: { ...updatedMetrics, level },
        lastClear: clearType,
        linesJustCleared: lines,
      });
      return spawnPiece(updated);
    }

    case "TICK": {
      if (state.status !== "running" || !state.active) {
        return state;
      }
      const candidate: ActivePiece = {
        ...state.active,
        position: {
          x: state.active.position.x,
          y: state.active.position.y + 1,
        },
      };
      if (!collides(state.board, candidate)) {
        return {
          ...state,
          active: candidate,
        };
      }

      const lockedBoard = mergePiece(state.board, state.active);
      const tspin = detectTSpin(state.board, state.active, true);
      const { board: clearedBoard, rowsCleared, lines } = clearLines(lockedBoard);
      const clearType: ClearType =
        rowsCleared === 1
          ? tspin
            ? "tspin"
            : "single"
          : rowsCleared === 2
            ? tspin
              ? "tspin"
              : "double"
            : rowsCleared === 3
              ? tspin
                ? "tspin"
                : "triple"
              : rowsCleared === 4
                ? "tetris"
                : tspin
                  ? "tspin"
                  : null;

      const newCombo = rowsCleared > 0 ? state.metrics.combo + 1 : 0;
      const newBackToBack =
        rowsCleared >= 4 || tspin
          ? state.metrics.backToBack + 1
          : rowsCleared === 0
            ? state.metrics.backToBack
            : 0;
      const comboBonus =
        rowsCleared > 0 ? Math.max(0, newCombo - 1) * 50 * state.metrics.level : 0;
      const baseScore =
        scoreForLines(rowsCleared, state.metrics.level, tspin) + comboBonus;
      const backToBackBonus =
        (rowsCleared >= 4 || tspin) && state.metrics.backToBack > 0
          ? Math.floor(baseScore * 0.5)
          : 0;

      const updatedMetrics: Metrics = {
        ...state.metrics,
        score: state.metrics.score + baseScore + backToBackBonus,
        lines: state.metrics.lines + rowsCleared,
        combo: newCombo,
        maxCombo: Math.max(state.metrics.maxCombo, newCombo),
        backToBack: newBackToBack,
      };
      const level = Math.min(20, Math.floor(updatedMetrics.lines / 10) + 1);
      const updated = applyAchievements({
        ...state,
        board: clearedBoard,
        active: null,
        queue: ensureQueue(state.queue),
        canHold: true,
        metrics: { ...updatedMetrics, level },
        lastClear: clearType,
        linesJustCleared: lines,
      });
      return spawnPiece(updated);
    }

    case "ROTATE": {
      if (state.status !== "running" || !state.active) {
        return state;
      }
      const direction = action.direction;
      let newRotation = state.active.rotation;
      if (direction === "CW") {
        newRotation = (state.active.rotation + 1) % 4;
      } else if (direction === "CCW") {
        newRotation = (state.active.rotation + 3) % 4;
      } else if (direction === "180") {
        newRotation = (state.active.rotation + 2) % 4;
      }
      const kicks = getKickTests(
        state.active.type,
        state.active.rotation,
        newRotation,
      );
      for (const kick of kicks) {
        const candidate: ActivePiece = {
          ...state.active,
          rotation: newRotation,
          position: {
            x: state.active.position.x + kick.x,
            y: state.active.position.y + kick.y,
          },
          kicked: true,
        };
        if (!collides(state.board, candidate)) {
          return { ...state, active: candidate };
        }
      }
      return state;
    }

    case "HOLD": {
      if (state.status !== "running" || !state.active || !state.canHold) {
        return state;
      }
      const hold = state.hold;
      const newActiveType = hold ?? ensureQueue(state.queue)[0];
      const updatedQueue = hold ? state.queue : ensureQueue(state.queue).slice(1);

      const updatedState: EngineState = {
        ...state,
        hold: state.active.type,
        canHold: false,
        queue: updatedQueue,
        active: {
          type: newActiveType,
          rotation: 0,
          position: {
            x: Math.floor(BOARD_WIDTH / 2) - 1,
            y: 1,
          },
        },
      };
      if (collides(updatedState.board, updatedState.active!)) {
        return {
          ...updatedState,
          active: null,
          status: "over",
        };
      }
      return updatedState;
    }

    case "APPLY_PENDING_ACHIEVEMENTS": {
      if (state.pendingAchievements.length === 0) {
        return state;
      }
      return {
        ...state,
        pendingAchievements: [],
      };
    }

    default:
      return state;
  }
};

export const useTetrisEngine = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("tetris-high-score");
    if (stored) {
      const value = Number.parseInt(stored, 10);
      if (!Number.isNaN(value)) {
        dispatch({ type: "HYDRATE_HIGH_SCORE", value });
      }
    }
  }, []);

  useEffect(() => {
    if (state.metrics.score > state.highScore && typeof window !== "undefined") {
      window.localStorage.setItem("tetris-high-score", String(state.metrics.score));
    }
  }, [state.metrics.score, state.highScore]);

  useEffect(() => {
    if (state.status !== "running") {
      return undefined;
    }
    const speed = Math.max(80, 900 - (state.metrics.level - 1) * 60);
    const interval = setInterval(() => {
      dispatch({ type: "TICK" });
    }, speed);
    return () => clearInterval(interval);
  }, [state.status, state.metrics.level]);

  useEffect(() => {
    if (state.pendingAchievements.length === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      dispatch({ type: "APPLY_PENDING_ACHIEVEMENTS" });
    }, 2500);
    return () => clearTimeout(timeout);
  }, [state.pendingAchievements.length]);

  const ghost = useMemo(() => {
    if (!state.active) {
      return [];
    }
    return getGhostBlocks(state.board, state.active);
  }, [state.board, state.active]);

  const move = useCallback((direction: -1 | 1) => {
    dispatch({ type: "MOVE", direction });
  }, []);

  const rotate = useCallback((direction: "CW" | "CCW" | "180") => {
    dispatch({ type: "ROTATE", direction });
  }, []);

  const softDrop = useCallback(() => {
    dispatch({ type: "SOFT_DROP" });
  }, []);

  const hardDrop = useCallback(() => {
    dispatch({ type: "HARD_DROP" });
  }, []);

  const hold = useCallback(() => {
    dispatch({ type: "HOLD" });
  }, []);

  const start = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: "PAUSE" });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: "RESUME" });
  }, []);

  return {
    board: state.board,
    active: state.active,
    ghost,
    queue: ensureQueue(state.queue),
    hold: state.hold,
    canHold: state.canHold,
    status: state.status,
    metrics: state.metrics,
    lastClear: state.lastClear,
    linesJustCleared: state.linesJustCleared,
    achievements: state.pendingAchievements,
    unlockedAchievementIds: state.unlockedAchievements,
    highScore: Math.max(state.highScore, state.metrics.score),
    actions: {
      moveLeft: () => move(-1),
      moveRight: () => move(1),
      rotateCW: () => rotate("CW"),
      rotateCCW: () => rotate("CCW"),
      rotate180: () => rotate("180"),
      softDrop,
      hardDrop,
      hold,
      start,
      reset,
      pause,
      resume,
    },
  };
};
