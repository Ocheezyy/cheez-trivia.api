import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import redis, { RedisClientType } from "redis";
import type { Difficulty, RoomData } from "./types";
import { getGameRoom, setGameRoom } from "./redis-functions";
import { nanoid } from "nanoid";
import { fetchTriviaQuestions } from "./utils";

const app = express();
const server = http.createServer(app);

const redisClient: RedisClientType = redis.createClient();

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (adjust for production)
  },
});

app.use(express.json());

app.get("/api/rooms/:roomId", async (req: Request, res: Response) => {
  const { roomId } = req.params;

  try {
    const roomData = await getGameRoom(redisClient, roomId);
    if (roomData) {
      res.json(roomData);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch room data" });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on(
    "createRoom",
    async (playerName: string, numQuestions: number, category: number, difficulty: Difficulty) => {
      const questions = await fetchTriviaQuestions(numQuestions, category, difficulty);

      const roomData: RoomData = {
        gameId: nanoid(8),
        players: [{ id: socket.id, name: playerName, score: 0 }],
        questions: questions,
        host: playerName,
        messages: [],
        currentQuestion: 1,
        gameStarted: false,
        category: category,
        difficulty: difficulty,
      };

      io.to(socket.id).emit("roomCreated", roomData);
    }
  );

  socket.on("joinRoom", async (roomId: string, playerName: string) => {
    let roomData: RoomData | null = await getGameRoom(redisClient, roomId);

    if (!roomData) {
      io.to(socket.id).emit("joinFailed");
      return;
    }

    socket.join(roomId);
    roomData.players.push({ id: socket.id, name: playerName, score: 0 });
    await setGameRoom(redisClient, roomId, roomData);

    io.to(roomId).emit("playerJoined", roomData);
  });

  socket.on("submitAnswer", async (roomId: string, playerId: string, answer: string) => {
    const roomData = await getGameRoom(redisClient, roomId);

    if (roomData && roomData.currentQuestion) {
      const isCorrect = answer === roomData.questions[roomData.currentQuestion].correct_answer;

      roomData.players = roomData.players.map((player) =>
        player.id === playerId ? { ...player, score: player.score + (isCorrect ? 1 : 0) } : player
      );
      await setGameRoom(redisClient, roomId, roomData);

      io.to(roomId).emit("updatePlayerScore", roomData);
    }
  });

  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    const roomData = await getGameRoom(redisClient, roomId);
    if (roomData) {
      roomData.messages = [...roomData.messages, { message, user }];
      await setGameRoom(redisClient, roomId, roomData);

      io.to(roomId).emit("receivedMessage", roomData);
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    // TODO: Remove the user from their room and emit
    console.log("A user disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
