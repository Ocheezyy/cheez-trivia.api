import { Server, Socket } from "socket.io";
import { handleJoin } from "./join-handlers";
import { handleChat } from "./chat-handlers";
import { handleGame } from "./game-handlers";
import { handleMisc } from "./misc-handlers";
import { RedisClientType } from "redis";

export const setupSocketHandlers = (io: Server, redisClient: RedisClientType) => {
  io.on("connection", (socket: Socket) => {
    console.log("A user connected:", socket.id);

    handleJoin(io, socket, redisClient);
    handleChat(io, socket, redisClient);
    handleGame(io, socket, redisClient);
    handleMisc(io, socket, redisClient);

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
    });
  });
};
