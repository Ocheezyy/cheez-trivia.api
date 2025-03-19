import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { RedisClientType, createClient } from "redis";
import type { Difficulty, RoomData, TimeLimit } from "./types";
import { getGameRoom, setGameRoom } from "./redis-functions";
import { nanoid } from "nanoid";
import { fetchTriviaQuestions } from "./utils";

const app = express();
const server = http.createServer(app);

const redisClient: RedisClientType = createClient({
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASS,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

redisClient
  .connect()
  .then(() => console.log("Redis Connected!"))
  .catch((e) => {
    console.error("Failed to connect to redis", e);
    throw new Error("Could not connect to redis");
  });

redisClient.on("error", (err) => console.log("Redis Client Error", err));

const io = new Server(server, {
  cors: {
    origin: process.env.SITE_ORIGIN,
  },
});

app.use(express.json());
app.use(
  cors({
    origin: process.env.SITE_ORIGIN!,
  })
);

app.get("/api/healthCheck", async (req: Request, res: Response) => {
  res.status(200).send("OK");
});

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
    async (
      playerName: string,
      numQuestions: number,
      category: number,
      difficulty: Difficulty,
      timeLimit: TimeLimit
    ) => {
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
        timeLimit: timeLimit,
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

  socket.on("startGame", async (roomId: string) => {
    let roomData: RoomData | null = await getGameRoom(redisClient, roomId);
    if (!roomData) return;

    io.to(roomId).emit("gameStarted");
  });

  socket.on("submitAnswer", async (roomId: string, playerName: string, points: number) => {
    if (points === 0) return;
    const roomData = await getGameRoom(redisClient, roomId);

    if (roomData) {
      roomData.players = roomData.players.map((player) =>
        player.name === playerName ? { ...player, score: player.score + points } : player
      );
      await setGameRoom(redisClient, roomId, roomData);

      const playerObject = roomData.players.find((player) => player.name === playerName);
      if (!playerObject) return;
      io.to(roomId).emit("updatePlayerScore", { playerName, score: playerObject.score });
    }
  });

  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    const roomData = await getGameRoom(redisClient, roomId);
    if (!roomData) return;

    roomData.messages = [...roomData.messages, { message, user }];
    await setGameRoom(redisClient, roomId, roomData);

    io.to(roomId).emit("receivedMessage", { message, user });
  });

  socket.on("nextQuestion", async (roomId: string, playerName) => {
    const roomData = await getGameRoom(redisClient, roomId);
    if (!roomData) return;
    if (playerName !== roomData.host) return; // Maybe check that socket id matches too

    if (roomData.currentQuestion === roomData.questions.length) io.to(roomId).emit("gameEnd");
    else {
      roomData.currentQuestion = roomData.currentQuestion + 1;
      await setGameRoom(redisClient, roomId, roomData);
      io.to(roomId).emit("nextQuestion", roomData.currentQuestion);
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
