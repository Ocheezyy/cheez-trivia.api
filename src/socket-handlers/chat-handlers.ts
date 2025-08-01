import { getGameRoom, setGameRoom } from "../redis-functions";
import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { handleSocketError } from "./handleSocketError";
import { isValidRoomData } from "../utils";

export const handleChat = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    try {
      const roomData = await getGameRoom(redisClient, roomId);
      if (!roomData) throw new Error("Failed to get room data");
      if (!isValidRoomData(roomData)) {
        throw new Error("Invalid room data");
      }

      roomData.messages = [...roomData.messages, { message, user }];
      await setGameRoom(redisClient, roomId, roomData);

      io.to(roomId).emit("receivedMessage", message, user);
    } catch (error) {
      handleSocketError(socket, "Failed to send message", error);
    }
  });
};
