export type TetrominoType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type Point = { x: number; y: number };

type TetrominoDefinition = {
  name: TetrominoType;
  rotations: Point[][];
  color: string;
  accent: string;
};

const rotate = (shape: Point[]): Point[] =>
  shape.map((block) => ({
    x: block.y,
    y: -block.x,
  }));

const buildRotations = (initial: Point[]): Point[][] => {
  const rotations: Point[][] = [initial];
  for (let i = 1; i < 4; i += 1) {
    rotations.push(rotate(rotations[i - 1]));
  }
  return rotations.map((rotation) =>
    rotation.map((block) => ({
      x: block.x,
      y: block.y,
    })),
  );
};

export const TETROMINOES: Record<TetrominoType, TetrominoDefinition> = {
  I: {
    name: "I",
    rotations: buildRotations([
      { x: -2, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    color: "bg-cyan-400",
    accent: "shadow-[0_0_18px_rgba(34,211,238,0.65)]",
  },
  J: {
    name: "J",
    rotations: buildRotations([
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    color: "bg-blue-500",
    accent: "shadow-[0_0_18px_rgba(59,130,246,0.6)]",
  },
  L: {
    name: "L",
    rotations: buildRotations([
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: -1 },
    ]),
    color: "bg-orange-400",
    accent: "shadow-[0_0_18px_rgba(251,146,60,0.6)]",
  },
  O: {
    name: "O",
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ],
    ],
    color: "bg-amber-300",
    accent: "shadow-[0_0_18px_rgba(252,211,77,0.6)]",
  },
  S: {
    name: "S",
    rotations: buildRotations([
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ]),
    color: "bg-lime-400",
    accent: "shadow-[0_0_18px_rgba(163,230,53,0.58)]",
  },
  T: {
    name: "T",
    rotations: buildRotations([
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    ]),
    color: "bg-fuchsia-400",
    accent: "shadow-[0_0_18px_rgba(232,121,249,0.6)]",
  },
  Z: {
    name: "Z",
    rotations: buildRotations([
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    color: "bg-rose-400",
    accent: "shadow-[0_0_18px_rgba(251,113,133,0.6)]",
  },
};

export const TETROMINO_TYPES: TetrominoType[] = [
  "I",
  "J",
  "L",
  "O",
  "S",
  "T",
  "Z",
];

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 22; // includes hidden spawn rows
export const VISIBLE_HEIGHT = 20;
