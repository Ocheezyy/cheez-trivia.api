import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { RedisClientType, createClient } from "redis";
import { setupSocketHandlers } from "./socket-handlers/socket-manager";
import { createGameRoutes } from "./routes/game-routes";

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
app.use(cors({ origin: process.env.SITE_ORIGIN! }));

app.get("/api/healthCheck", async (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use("/api", createGameRoutes(redisClient));

setupSocketHandlers(io, redisClient);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
