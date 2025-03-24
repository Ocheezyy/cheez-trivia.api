import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { handleChat } from "../src/socket-handlers/chat-handlers";
import { getGameRoom, setGameRoom } from "../src/redis-functions";
import { RoomData, Message } from "../src/types";

jest.mock("../src/redis-functions", () => ({
  getGameRoom: jest.fn(),
  setGameRoom: jest.fn(),
}));

const mockRedisClient = {} as RedisClientType;

const mockSocket = {
  on: jest.fn(),
  id: "socket-123",
  join: jest.fn(),
} as unknown as Socket;

const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  sockets: {
    in: jest.fn(),
  },
} as unknown as Server;

const createTestRoom = (overrides?: Partial<RoomData>): RoomData => ({
  gameId: "game-1",
  players: [],
  host: "host-1",
  questions: [],
  messages: [],
  currentQuestion: 0,
  gameStarted: false,
  category: 9, // General Knowledge
  difficulty: "medium",
  timeLimit: "30",
  ...overrides,
});

const createTestMessage = (): Message => ({
  message: "Test message",
  user: "player-1",
});

describe("handleChat - sendMessage handler", () => {
  let handler: (roomId: string, message: string, user: string) => Promise<void>;
  const roomId = "room-1";

  beforeEach(() => {
    jest.clearAllMocks();
    (getGameRoom as jest.Mock).mockResolvedValue(createTestRoom());
    handleChat(mockIo, mockSocket, mockRedisClient);
    handler = (mockSocket.on as jest.Mock).mock.calls[0][1];
  });

  // Core functionality
  it("adds message to room and broadcasts it", async () => {
    const testMessage = createTestMessage();
    await handler(roomId, testMessage.message, testMessage.user);

    // Verify Redis operations
    expect(getGameRoom).toHaveBeenCalledWith(mockRedisClient, roomId);
    expect(setGameRoom).toHaveBeenCalledWith(
      mockRedisClient,
      roomId,
      expect.objectContaining({
        messages: [testMessage],
      })
    );

    // Verify socket emission
    expect(mockIo.to).toHaveBeenCalledWith(roomId);
    expect(mockIo.emit).toHaveBeenCalledWith("receivedMessage", testMessage.message, testMessage.user);
  });

  it("handles empty room gracefully", async () => {
    (getGameRoom as jest.Mock).mockResolvedValue(null);
    await handler(roomId, "test", "user");

    expect(setGameRoom).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it("preserves existing messages", async () => {
    const existingMessages: Message[] = [
      { message: "First", user: "player-1" },
      { message: "Second", user: "player-2" },
    ];
    (getGameRoom as jest.Mock).mockResolvedValue(createTestRoom({ messages: existingMessages }));

    const newMessage = createTestMessage();
    await handler(roomId, newMessage.message, newMessage.user);

    expect(setGameRoom).toHaveBeenCalledWith(
      mockRedisClient,
      roomId,
      expect.objectContaining({
        messages: [...existingMessages, newMessage],
      })
    );
  });

  // Security cases
  it("handles XSS attempts", async () => {
    const maliciousMessage = "<script>alert('hack')</script>";
    await handler(roomId, maliciousMessage, "attacker");

    expect(setGameRoom).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        messages: [
          {
            user: "attacker",
            message: maliciousMessage,
          },
        ],
      })
    );
  });

  // Performance cases
  it("handles 100+ messages efficiently", async () => {
    const massMessages = Array(100)
      .fill(0)
      .map((_, i) => ({
        message: `Msg ${i}`,
        user: `user-${i % 5}`,
      }));

    (getGameRoom as jest.Mock).mockResolvedValue(createTestRoom({ messages: massMessages }));

    await handler(roomId, "Final message", "final-user");

    const savedMessages = (setGameRoom as jest.Mock).mock.calls[0][2].messages;
    expect(savedMessages).toHaveLength(101);
    expect(savedMessages[100]).toEqual({
      message: "Final message",
      user: "final-user",
    });
  });

  it("does nothing when redis returns null", async () => {
    (getGameRoom as jest.Mock).mockResolvedValue(null);
    await handler(roomId, "test-message", "test-user");

    expect(setGameRoom).not.toHaveBeenCalled();
    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
