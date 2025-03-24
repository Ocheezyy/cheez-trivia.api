import { RoomData } from "./types";
import { RedisClientType } from "redis";

const GAME_ROOM_KEY = process.env.GAME_ROOM_KEY!;

export async function getGameRoom(redisClient: RedisClientType, roomId: string): Promise<RoomData | null> {
  try {
    const data = await redisClient.hGet(GAME_ROOM_KEY, roomId);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Error getting gameRoom", err);
    return null;
  }
}

export async function setGameRoom(
  redisClient: RedisClientType,
  roomId: string,
  data: RoomData
): Promise<boolean> {
  try {
    await redisClient.hSet(GAME_ROOM_KEY, roomId, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Error setting gameRoom", err);
    return false;
  }
}
