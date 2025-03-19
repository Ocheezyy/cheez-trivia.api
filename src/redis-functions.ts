import { RoomData } from "./types";
import { RedisClientType } from "redis";

const GAME_ROOM_KEY = "triviaRooms";

export async function getGameRoom(redisClient: RedisClientType, roomId: string): Promise<RoomData | null> {
  const data = await redisClient.hGet(GAME_ROOM_KEY, roomId);
  return data ? JSON.parse(data) : null;
}

export async function setGameRoom(
  redisClient: RedisClientType,
  roomId: string,
  data: RoomData
): Promise<boolean> {
  await redisClient.hSet(GAME_ROOM_KEY, roomId, JSON.stringify(data));
  return true;
}
