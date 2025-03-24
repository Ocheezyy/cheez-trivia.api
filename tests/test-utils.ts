// Test data builders
import type { Player, RoomData } from "../src/types";

export const createTestPlayer = (overrides?: Partial<Player>): Player => ({
  id: "player-1",
  name: "Test Player",
  score: 0,
  hasAnswered: false,
  correctAnswers: 0,
  totalAnswers: 0,
  fastestAnswer: 0,
  ...overrides,
});

export const createTestRoom = (overrides?: Partial<RoomData>): RoomData => ({
  gameId: "game-1",
  players: [createTestPlayer()],
  host: "host-1",
  questions: Array(10).fill({}),
  messages: [],
  currentQuestion: 0,
  gameStarted: false,
  category: 9,
  difficulty: "medium",
  timeLimit: "30",
  ...overrides,
});
