import { getGameRoom, setGameRoom } from "../redis-functions";
import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { handleSocketError } from "./handleSocketError";
import { isValidRoomData, validateMessage } from "../utils";

const messageRateLimit = new Map<string, number>();

export const handleChat = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("sendMessage", async (roomId: string, message: string, user: string) => {
    try {
      const isValidMessage = validateMessage(message);
      if (!isValidMessage) {
        throw new Error("Invalid message");
      }

      const now = Date.now();
      const lastMessage = messageRateLimit.get(socket.id) || 0;

      if (now - lastMessage < 4000) {
        // 4-second cooldown
        socket.emit("error", { message: "Please wait before sending another message" });
        return;
      }

      const roomData = await getGameRoom(redisClient, roomId);
      if (!roomData) throw new Error("Failed to get room data");
      if (!isValidRoomData(roomData)) {
        throw new Error("Invalid room data");
      }

      const MAX_MESSAGES = 50;
      roomData.messages = [...roomData.messages, { message, user }].slice(-MAX_MESSAGES);
      await setGameRoom(redisClient, roomId, roomData);

      messageRateLimit.set(socket.id, now);

      io.to(roomId).emit("receivedMessage", message, user);
    } catch (error) {
      handleSocketError(socket, "Failed to send message", error);
    }
  });
};
