import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { RedisClientType, createClient } from "redis";
import { CreateRoomBody, JoinRoomBody, RoomData } from "./types";
import { getGameRoom, setGameRoom } from "./redis-functions";
import { createRoomId, fetchTriviaQuestions } from "./utils";

const app = express();
const server = http.createServer(app);

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
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

app.post("/api/createRoom", async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateRoomBody;

    if (!body.playerName || body.playerName === "") {
      res.status(400).send("Need to specify a playerName");
      return;
    }

    // console.log(body);
    const questions = await fetchTriviaQuestions(body.numQuestions, body.categoryId, body.difficulty);
    const roomId = await createRoomId(redisClient);
    const roomData: RoomData = {
      gameId: roomId,
      players: [{ id: "", name: body.playerName, score: 0, hasAnswered: false }],
      questions: questions,
      host: body.playerName,
      messages: [],
      currentQuestion: 1,
      gameStarted: false,
      category: body.categoryId,
      difficulty: body.difficulty,
      timeLimit: body.timeLimit,
    };
    await setGameRoom(redisClient, roomId, roomData);
    res.status(200).json({ roomId: roomId, playerName: body.playerName });
  } catch (error) {
    console.error("Failed to create room", error);
    res.status(500).send("Server Error");
  }
});

app.post("/api/joinRoom", async (req: Request, res: Response) => {
  try {
    const body = req.body as JoinRoomBody;
    body.roomId = body.roomId.toUpperCase();
    const roomData = await getGameRoom(redisClient, body.roomId);
    if (!roomData) {
      console.error("Failed to join room with id: " + body.roomId);
      res.status(400).send("Room not found");
      return;
    }

    const playerNames = roomData.players.map((player) => player.name);
    if (playerNames.includes(body.playerName)) {
      console.error(`Player name ${body.playerName} already in room ${body.roomId}`);
      res.status(400).send("Player name taken");
      return;
    }

    const playerCount = playerNames.length;
    if (playerCount > 10) {
      console.error("Player tried to join full room id: " + body.roomId);
      res.status(423).send("Room full");
      return;
    }

    res.status(200).json(body);
  } catch (error) {
    console.error("Failed to join room", error);
    res.status(500).send("Server Error");
  }
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

  socket.on("hostJoin", async (playerName: string, roomId: string) => {
    const roomData: RoomData | null = await getGameRoom(redisClient, roomId);

    if (!roomData) {
      console.log(`${socket.id} Failed to join room with id ${roomId} as host`);
      io.to(socket.id).emit("hostJoinFailed", roomId);
      return;
    }

    roomData.players = roomData.players.map((player) =>
      player.name === playerName ? { ...player, id: socket.id } : player
    );
    await setGameRoom(redisClient, roomId, roomData);
    socket.join(roomId);

    io.to(socket.id).emit("hostJoined", roomData);
  });

  socket.on("joinRoom", async (roomId: string, playerName: string) => {
    let roomData: RoomData | null = await getGameRoom(redisClient, roomId);

    if (!roomData) {
      console.log(`${socket.id} Failed to join room ${roomId}`);
      io.to(socket.id).emit("joinFailed", "Room not found");
      return;
    }

    if (roomData.players.find((player) => player.name === playerName)) {
      io.to(socket.id).emit("joinFailed", "Name not available");
      return;
    }

    socket.join(roomId);
    roomData.players.push({ id: socket.id, name: playerName, score: 0, hasAnswered: false });
    await setGameRoom(redisClient, roomId, roomData);

    io.to(roomId).emit("playerJoined", roomData);

    const socketsInRoom = await io.in(roomId).fetchSockets();
    console.log(
      `Sockets in room ${roomId}: `,
      socketsInRoom.map((s) => s.id)
    );
  });

  socket.on("startGame", async (roomId: string) => {
    let roomData: RoomData | null = await getGameRoom(redisClient, roomId);
    if (!roomData) return;

    io.to(roomId).emit("gameStarted");
  });

  socket.on("submitAnswer", async (roomId: string, playerName: string, points: number) => {
    const roomData = await getGameRoom(redisClient, roomId);

    if (roomData) {
      roomData.players = roomData.players.map((player) =>
        player.name === playerName ? { ...player, score: player.score + points, hasAnswered: true } : player
      );
      await setGameRoom(redisClient, roomId, roomData);

      const playerObject = roomData.players.find((player) => player.name === playerName);
      if (!playerObject) return;

      if (points !== 0) {
        io.to(roomId).emit("updatePlayerScore", { playerName, score: playerObject.score });
      }

      const allAnswered =
        roomData.players.filter((player) => player.hasAnswered).length === roomData.players.length;
      if (allAnswered) {
        console.log("All players answered");
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
  });

  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    const roomData = await getGameRoom(redisClient, roomId);
    if (!roomData) return;

    roomData.messages = [...roomData.messages, { message, user }];
    await setGameRoom(redisClient, roomId, roomData);

    io.to(roomId).emit("receivedMessage", message, user);
  });

  socket.on("reconnect", async (roomId, playerName) => {
    const roomData = await getGameRoom(redisClient, roomId);

    if (!roomData) {
      io.to(socket.id).emit("reconnectFailed", "Room not found");
      console.log(`${socket.id} Failed to reconnect to room ${roomId}`);
      return;
    }

    socket.join(roomId);
    console.log(`Socket ${socket.id} reconnected and rejoined room ${roomId}`);

    roomData.players = roomData.players.map((player) =>
      player.name === playerName ? { ...player, id: socket.id } : player
    );
    await setGameRoom(redisClient, roomId, roomData);

    io.to(roomId).emit("playerReconnected", { playerName, roomData });
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
