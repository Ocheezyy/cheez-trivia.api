import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { getGameRoom, setGameRoom } from "../redis-functions";
import { RoomData } from "../types";

const timeouts = new Map<string, NodeJS.Timeout>();

export const handleGame = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("startGame", async (roomId: string) => {
    try {
      let roomData: RoomData | null = await getGameRoom(redisClient, roomId);
      if (!roomData) return;

      io.to(roomId).emit("gameStarted");
    } catch (error) {
      console.error("Failed to start game", error);
      socket.emit("error", error);
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
              if (roomData.currentQuestion === roomData.questions.length) io.to(roomId).emit("gameEnd");
              else {
                roomData.players = roomData.players.map((player) => ({ ...player, hasAnswered: false }));
                roomData.currentQuestion = roomData.currentQuestion + 1;
                await setGameRoom(redisClient, roomId, roomData);
                io.to(roomId).emit("nextQuestion", roomData.currentQuestion);
              }
            }, 5000)
          );
        }
      } catch (error) {
        console.error("Failed to submit answer", error);
        socket.emit("error", error);
      }
    }
  );

  // TODO: Create game end event
  // socket.on("gameEnd", (roomId: string) => {
  //   const timeout = timeouts.get(roomId);
  //   if (timeout) {
  //     clearTimeout(timeout);
  //     timeouts.delete(roomId);
  //   }
  // });
};
