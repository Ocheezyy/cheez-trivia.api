import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { getGameRoom, setGameRoom } from "../redis-functions";
import { RoomData } from "../types";

export const handleGame = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("startGame", async (roomId: string) => {
    let roomData: RoomData | null = await getGameRoom(redisClient, roomId);
    if (!roomData) return;

    io.to(roomId).emit("gameStarted");
  });

  socket.on(
    "submitAnswer",
    async (roomId: string, playerName: string, points: number, answerTime: number) => {
      const roomData = await getGameRoom(redisClient, roomId);

      if (roomData) {
        roomData.players = roomData.players.map((player) =>
          player.name === playerName ? { ...player, score: player.score + points, hasAnswered: true } : player
        );
        await setGameRoom(redisClient, roomId, roomData);

        const playerObject = roomData.players.find((player) => player.name === playerName);
        if (!playerObject) return;

        playerObject.totalAnswers = playerObject.totalAnswers + 1;

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
          console.log(`All players answered in room: ${roomData.gameId}`);
          io.to(roomId).emit("allAnswered");
          setTimeout(async () => {
            if (roomData.currentQuestion === roomData.questions.length) io.to(roomId).emit("gameEnd");
            else {
              roomData.players = roomData.players.map((player) => ({ ...player, hasAnswered: false }));
              roomData.currentQuestion = roomData.currentQuestion + 1;
              await setGameRoom(redisClient, roomId, roomData);
              io.to(roomId).emit("nextQuestion", roomData.currentQuestion);
            }
          }, 10000);
        }
      }
    }
  );
};
