import { Router } from "express";
import { getGameRoom } from "../redis-functions";
import { CreateRoomBody, JoinRoomBody, RoomData } from "../types";
import { setGameRoom } from "../redis-functions";
import { createRoomId, fetchTriviaQuestions, newPlayerObject } from "../utils";
import { RedisClientType } from "redis";

export const createGameRoutes = (redisClient: RedisClientType) => {
  const router = Router();

  router.post("/createRoom", async (req, res) => {
    try {
      const body = req.body as CreateRoomBody;

      if (!body.playerName || body.playerName === "") {
        res.status(400).send("Need to specify a playerName");
        return;
      }

      const questions = await fetchTriviaQuestions(body.numQuestions, body.categoryId, body.difficulty);
      const roomId = await createRoomId(redisClient);
      const roomData: RoomData = {
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
      };
      await setGameRoom(redisClient, roomId, roomData);
      res.status(200).json({ roomId: roomId, playerName: body.playerName });
    } catch (error) {
      console.error("Failed to create room", error);
      res.status(500).send("Server Error");
    }
  });

  router.post("/joinRoom", async (req, res) => {
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

  router.get("/game-over/:roomId", async (req, res) => {
    const { roomId } = req.params;

    try {
      const roomData = await getGameRoom(redisClient, roomId);
      if (!roomData) {
        console.error("Failed to get game over room with id: " + roomId);
        res.status(400).send("Room not found");
        return;
      }
      res.status(200).json(roomData);
    } catch (e) {
      console.error("Failed to get game over room", e);
      res.status(500).send("Server Error");
    }
  });

  return router;
};
