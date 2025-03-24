import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { handleGame } from "../src/socket-handlers/game-handlers";
import * as redisFunctions from "../src/redis-functions";
import { createTestPlayer, createTestRoom } from "./test-utils";

// Mock redis functions
jest.mock("../src/redis-functions", () => ({
  getGameRoom: jest.fn(),
  setGameRoom: jest.fn(),
}));

describe("handleGame", () => {
  const mockRedisClient = {} as RedisClientType;
  const mockSocket = {
    on: jest.fn(),
    id: "test-socket",
  } as unknown as Socket;

  const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      in: jest.fn(),
    },
  } as unknown as Server;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (redisFunctions.getGameRoom as jest.Mock).mockResolvedValue(createTestRoom());
    handleGame(mockIo, mockSocket, mockRedisClient);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("startGame handler", () => {
    it("emits gameStarted when room exists", async () => {
      const startGameHandler = (mockSocket.on as jest.Mock).mock.calls[0][1];
      await startGameHandler("valid-room");

      expect(mockIo.to).toHaveBeenCalledWith("valid-room");
      expect(mockIo.emit).toHaveBeenCalledWith("gameStarted");
    });

    it("does nothing when room doesn't exist", async () => {
      (redisFunctions.getGameRoom as jest.Mock).mockResolvedValueOnce(null);
      const startGameHandler = (mockSocket.on as jest.Mock).mock.calls[0][1];
      await startGameHandler("invalid-room");

      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });

  describe("submitAnswer handler", () => {
    const roomId = "test-room";
    const playerName = "Test Player";
    const points = 10;
    const answerTime = 5000;

    let submitAnswerHandler: (
      roomId: string,
      playerName: string,
      points: number,
      answerTime: number
    ) => Promise<void>;

    beforeEach(() => {
      jest.useFakeTimers();
      submitAnswerHandler = (mockSocket.on as jest.Mock).mock.calls[1][1];
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("updates player score for correct answer", async () => {
      await submitAnswerHandler(roomId, playerName, points, answerTime);

      // Verify score update
      expect(redisFunctions.setGameRoom).toHaveBeenCalled();
      const updatedRoom = (redisFunctions.setGameRoom as jest.Mock).mock.calls[0][2];
      expect(updatedRoom.players[0].score).toBe(points);
      expect(updatedRoom.players[0].correctAnswers).toBe(1);
      expect(updatedRoom.players[0].fastestAnswer).toBe(answerTime);

      // Verify emission
      expect(mockIo.to).toHaveBeenCalledWith(roomId);
      expect(mockIo.emit).toHaveBeenCalledWith("updatePlayerScore", playerName, points);
    });

    it("handles incorrect answers (0 points)", async () => {
      await submitAnswerHandler(roomId, playerName, 0, answerTime);

      const updatedRoom = (redisFunctions.setGameRoom as jest.Mock).mock.calls[0][2];
      expect(updatedRoom.players[0].score).toBe(0);
      expect(updatedRoom.players[0].correctAnswers).toBe(0);
      expect(mockIo.emit).not.toHaveBeenCalledWith("updatePlayerScore", expect.anything(), expect.anything());
    });

    it("marks allAnswered when all players have responded", async () => {
      // Setup room with 2 players
      const twoPlayerRoom = createTestRoom({
        players: [
          createTestPlayer({ name: "Player1", hasAnswered: false }),
          createTestPlayer({ name: "Player2", hasAnswered: false }),
        ],
      });
      (redisFunctions.getGameRoom as jest.Mock).mockResolvedValue(twoPlayerRoom);

      // First player answers
      await submitAnswerHandler(roomId, "Player1", points, answerTime);

      // Second player answers
      await submitAnswerHandler(roomId, "Player2", points, answerTime);

      // Verify allAnswered emission
      expect(mockIo.emit).toHaveBeenCalledWith("allAnswered");
    });

    // it("moves to next question after delay when all answered", async () => {
    //   const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    //
    //   // Initial room setup
    //   const initialRoom = createTestRoom({
    //     players: [
    //       createTestPlayer({
    //         name: playerName,
    //         hasAnswered: false,
    //         score: 0,
    //         correctAnswers: 0,
    //         totalAnswers: 0,
    //         fastestAnswer: 0,
    //       }),
    //     ],
    //     currentQuestion: 1,
    //   });
    //
    //   (redisFunctions.getGameRoom as jest.Mock).mockResolvedValue(initialRoom);
    //
    //   // Execute the handler
    //   await submitAnswerHandler(roomId, playerName, points, answerTime);
    //
    //   // Verify immediate effects
    //   expect(mockIo.emit).toHaveBeenNthCalledWith(1, "updatePlayerScore", playerName, points);
    //   expect(mockIo.emit).toHaveBeenNthCalledWith(2, "allAnswered");
    //   expect(consoleSpy).toHaveBeenCalledWith("All players answered");
    //
    //   // Verify the timer is set
    //   expect(jest.getTimerCount()).toBe(1);
    //
    //   // Check the first Redis update (score update)
    //   const firstUpdate = (redisFunctions.setGameRoom as jest.Mock).mock.calls[0][2];
    //   expect(firstUpdate.players[0].score).toBe(points);
    //   expect(firstUpdate.players[0].hasAnswered).toBe(true);
    //
    //   // Fast-forward exactly 10 seconds
    //   jest.advanceTimersByTime(10000);
    //
    //   // Verify the delayed effects
    //   expect(mockIo.emit).toHaveBeenNthCalledWith(3, "nextQuestion", 2);
    //
    //   // Check the second Redis update (question advance)
    //   const secondUpdate = (redisFunctions.setGameRoom as jest.Mock).mock.calls[1][2];
    //   expect(secondUpdate.currentQuestion).toBe(1);
    //   expect(secondUpdate.players[0].hasAnswered).toBe(false);
    //
    //   // Verify timer is cleared
    //   expect(jest.getTimerCount()).toBe(0);
    //
    //   // Verify total Redis calls
    //   expect(redisFunctions.setGameRoom).toHaveBeenCalledTimes(2);
    //
    //   consoleSpy.mockRestore();
    //   console.log("All emissions:", (mockIo.emit as jest.Mock).mock.calls);
    //   console.log("All Redis calls:", (redisFunctions.setGameRoom as jest.Mock).mock.calls);
    // });

    it("ends game when last question is answered", async () => {
      const lastQuestionRoom = createTestRoom({
        currentQuestion: 10,
        players: [createTestPlayer({ hasAnswered: false })],
      });
      (redisFunctions.getGameRoom as jest.Mock).mockResolvedValue(lastQuestionRoom);

      await submitAnswerHandler(roomId, playerName, points, answerTime);
      jest.advanceTimersByTime(10000);

      expect(mockIo.emit).toHaveBeenCalledWith("gameEnd");
      expect(mockIo.emit).not.toHaveBeenCalledWith("nextQuestion");
    });

    it("does nothing when room doesn't exist", async () => {
      (redisFunctions.getGameRoom as jest.Mock).mockResolvedValueOnce(null);
      await submitAnswerHandler(roomId, playerName, points, answerTime);

      expect(redisFunctions.setGameRoom).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });
});
