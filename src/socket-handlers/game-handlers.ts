import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { getGameRoom, setGameRoom } from "../redis-functions";
import { RoomData } from "../types";
import { handleSocketError } from "./handleSocketError";
import { isValidRoomData } from "../utils";

const timeouts = new Map<string, NodeJS.Timeout>();

const clearRoomTimeouts = (roomId: string) => {
  for (const [key, timeout] of timeouts.entries()) {
    if (key.startsWith(roomId)) {
      clearTimeout(timeout);
      timeouts.delete(key);
    }
  }
};

export const handleGame = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("startGame", async (roomId: string) => {
    try {
      let roomData: RoomData | null = await getGameRoom(redisClient, roomId);
      if (!roomData) throw new Error("Failed to get room data");
      if (!isValidRoomData(roomData)) {
        throw new Error("Invalid room data");
      }

      io.to(roomId).emit("gameStarted");

      // Start countdown timer for first question
      timeouts.set(
        `${roomId}-start`,
        setTimeout(async () => {
          roomData = await getGameRoom(redisClient, roomId);
          if (!roomData || !isValidRoomData(roomData)) return;

          roomData.currentQuestion = 1;
          await setGameRoom(redisClient, roomId, roomData);
          io.to(roomId).emit("nextQuestion", roomData.currentQuestion);
        }, 3000) // 3 second countdown before first question
      );
    } catch (error) {
      handleSocketError(socket, "Failed to start game", error);
    }
  });

  socket.on(
    "submitAnswer",
    async (roomId: string, playerName: string, points: number, answerTime: number) => {
      try {
        const roomData = await getGameRoom(redisClient, roomId);

        if (!roomData) {
          throw new Error("Room not found");
        }

        if (!isValidRoomData(roomData)) {
          throw new Error("Invalid room data");
        }

        if (roomData.players.find((p) => p.name === playerName)?.hasAnswered) return;

        roomData.players = roomData.players.map((player) =>
          player.name === playerName ? { ...player, score: player.score + points, hasAnswered: true } : player
        );
        await setGameRoom(redisClient, roomId, roomData);

        const playerObject = roomData.players.find((player) => player.name === playerName);
        if (!playerObject) return;

        playerObject.totalAnswers = playerObject.totalAnswers + 1;
        playerObject.hasAnswered = true;

        if (points !== 0) {
          io.to(roomId).emit("updatePlayerScore", playerName, playerObject.score);
          playerObject.correctAnswers = playerObject.correctAnswers + 1;
          if (playerObject.fastestAnswer < answerTime) {
            playerObject.fastestAnswer = answerTime;
          }
        }

        roomData.players = roomData.players.map((player) =>
          player.name === playerName ? { ...playerObject } : player
        );

        await setGameRoom(redisClient, roomId, roomData);

        const allAnswered =
          roomData.players.filter((player) => player.hasAnswered).length === roomData.players.length;
        if (allAnswered) {
          console.log(
            `All players answered question: ${roomData.currentQuestion}, in room: ${roomData.gameId}`
          );
          io.to(roomId).emit(`allAnswered`);
          timeouts.set(
            `${roomId} ${roomData.currentQuestion}`,
            setTimeout(async () => {
              const updatedRoomData = await getGameRoom(redisClient, roomId);
              if (!updatedRoomData || !isValidRoomData(updatedRoomData)) return;

              if (updatedRoomData.currentQuestion === updatedRoomData.questions.length) {
                clearRoomTimeouts(roomId);
                io.to(roomId).emit("gameEnd");
              } else {
                updatedRoomData.players = updatedRoomData.players.map((player) => ({
                  ...player,
                  hasAnswered: false,
                }));
                updatedRoomData.currentQuestion = updatedRoomData.currentQuestion + 1;
                await setGameRoom(redisClient, roomId, updatedRoomData);
                io.to(roomId).emit("nextQuestion", updatedRoomData.currentQuestion);
              }
            }, 5000)
          );
        }
      } catch (error) {
        handleSocketError(socket, "Failed to submit answer", error);
      }
    }
  );

  // Handle cleanup when game ends
  socket.on("disconnect", () => {
    // Find and clear any timeouts associated with this socket's rooms
    socket.rooms.forEach((roomId) => {
      clearRoomTimeouts(roomId);
    });
  });
};
