import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { getGameRoom, setGameRoom } from "../redis-functions";

export const handleMisc = (io: Server, socket: Socket, redisClient: RedisClientType) => {
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
};
