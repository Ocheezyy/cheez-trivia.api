import request from "supertest";
import express from "express";
import { createGameRoutes } from "../src/routes/game-routes";
import { RedisClientType } from "redis";
import { CreateRoomBody, Question } from "../src/types";
import { createRoomData, newPlayerObject } from "../src/utils";

// Mock Redis functions
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  hGet: jest.fn().mockResolvedValue(null),
} as unknown as RedisClientType;

jest.mock("../src/redis-functions", () => ({
  setGameRoom: jest.fn().mockResolvedValue(null),
  getGameRoom: jest.fn(async (_client, roomId) => {
    if (roomId === "XBCJYN") {
      return {
        gameId: "XBCJYN",
        players: [{ name: "Player1" }],
        host: "Player1",
        questions: [],
        messages: [],
        currentQuestion: 1,
        gameStarted: false,
        category: 9,
        difficulty: "medium",
        timeLimit: 30,
      };
    }
    return null;
  }),
}));

jest.mock("../src/utils", () => ({
  fetchTriviaQuestions: jest.fn().mockResolvedValue([
    {
      type: "boolean",
      difficulty: "medium",
      category: "9",
      question: "This is a question",
      correct_answer: "It is",
      all_answers: ["True", "False"],
    },
  ]),
  createRoomId: jest.fn().mockResolvedValue("XBCJYN"),
  newPlayerObject: jest
    .fn()
    .mockImplementation(async (playerName: string, socketId: string, timeLimit: string) => ({
      id: socketId,
      name: playerName,
      score: 0,
      hasAnswered: false,
      fastestAnswer: Number(timeLimit),
      correctAnswers: 0,
      totalAnswers: 0,
    })),
  createRoomData: jest
    .fn()
    .mockImplementation((body: CreateRoomBody, roomId: string, questions: Question[]) => ({
      gameId: roomId,
      players: [newPlayerObject(body.playerName, "", body.timeLimit)],
      questions: questions,
      host: body.playerName,
      messages: [],
      currentQuestion: 1,
      gameStarted: false,
      category: body.categoryId,
      difficulty: body.difficulty,
      timeLimit: body.timeLimit,
    })),
}));

// Set up the Express app
const app = express();
app.use(express.json());
app.use("/game", createGameRoutes(mockRedisClient));

describe("Game API Routes", () => {
  test("POST /game/createRoom - should create a room successfully", async () => {
    const response = await request(app).post("/game/createRoom").send({
      playerName: "TestPlayer",
      numQuestions: 10,
      categoryId: 9,
      difficulty: "medium",
      timeLimit: "30",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("roomId", "XBCJYN");
    expect(response.body).toHaveProperty("playerName", "TestPlayer");
  });

  test("POST /game/createRoom - should return 400 if playerName is missing", async () => {
    const response = await request(app).post("/game/createRoom").send({
      numQuestions: 10,
      categoryId: 9,
      difficulty: "medium",
      timeLimit: "30",
    });

    expect(response.status).toBe(400);
    expect(response.text).toBe("Need to specify a playerName");
  });

  test("POST /game/joinRoom - should join a valid room", async () => {
    const response = await request(app).post("/game/joinRoom").send({
      playerName: "NewPlayer",
      roomId: "XBCJYN",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("playerName", "NewPlayer");
    expect(response.body).toHaveProperty("roomId", "XBCJYN");
  });

  test("POST /game/joinRoom - should return 400 if room does not exist", async () => {
    const response = await request(app).post("/game/joinRoom").send({
      playerName: "NewPlayer",
      roomId: "INVALIDROOM",
    });

    expect(response.status).toBe(400);
    expect(response.text).toBe("Room not found");
  });

  test("GET /game/game-over/:roomId - should return room data for valid room", async () => {
    const response = await request(app).get("/game/game-over/XBCJYN");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("gameId", "XBCJYN");
  });

  test("GET /game/game-over/:roomId - should return 400 if room is not found", async () => {
    const response = await request(app).get("/game/game-over/JYNXBC");

    expect(response.status).toBe(400);
    expect(response.text).toBe("Room not found");
  });
});
