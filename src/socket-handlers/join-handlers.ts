import { RoomData } from "../types";
import { getGameRoom, setGameRoom } from "../redis-functions";
import { newPlayerObject } from "../utils";
import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";

export const handleJoin = (io: Server, socket: Socket, redisClient: RedisClientType) => {
  socket.on("hostJoin", async (playerName: string, roomId: string) => {
    try {
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
    } catch (error) {
      console.error("Failed to join room (host)", error);
      socket.emit("error", error);
    }
  });

  socket.on("joinRoom", async (roomId: string, playerName: string) => {
    try {
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
      roomData.players.push(newPlayerObject(playerName, socket.id, roomData.timeLimit));
      await setGameRoom(redisClient, roomId, roomData);

      io.to(roomId).emit("playerJoined", roomData);

      const socketsInRoom = await io.in(roomId).fetchSockets();
      console.log(
        `Sockets in room ${roomId}: `,
        socketsInRoom.map((s) => s.id)
      );
    } catch (error) {
      console.error("Failed to join room", error);
      socket.emit("error", error);
    }
  });
};
