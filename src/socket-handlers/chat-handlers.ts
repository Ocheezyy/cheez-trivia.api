import { getGameRoom, setGameRoom } from "../redis-functions";
import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";

export const handleChat = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    try {
      const roomData = await getGameRoom(redisClient, roomId);
      if (!roomData) return;

      roomData.messages = [...roomData.messages, { message, user }];
      await setGameRoom(redisClient, roomId, roomData);

      io.to(roomId).emit("receivedMessage", message, user);
    } catch (error) {
      console.error("Failed to send message", error);
      socket.emit("error", error);
    }
  });
};
