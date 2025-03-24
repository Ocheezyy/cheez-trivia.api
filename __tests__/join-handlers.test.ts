import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { handleJoin } from "../src/socket-handlers/join-handlers";
import { getGameRoom, setGameRoom } from "../src/redis-functions";
import { newPlayerObject } from "../src/utils";
import { createTestPlayer, createTestRoom } from "./test-utils";

// Mock dependencies
jest.mock("../src/redis-functions", () => ({
  getGameRoom: jest.fn(),
  setGameRoom: jest.fn(),
}));

jest.mock("../src/utils", () => ({
  newPlayerObject: jest.fn().mockImplementation((name, id, timeLimit) => ({
    name,
    id,
    score: 0,
    answerTimes: [],
    timeLimit,
  })),
}));

const mockGetGameRoom = getGameRoom as jest.MockedFunction<typeof getGameRoom>;
const mockSetGameRoom = setGameRoom as jest.MockedFunction<typeof setGameRoom>;
const mockNewPlayerObject = newPlayerObject as jest.MockedFunction<typeof newPlayerObject>;

describe("handleJoin", () => {
  let io: jest.Mocked<Server>;
  let socket: jest.Mocked<Socket>;
  let redisClient: jest.Mocked<RedisClientType>;
  const mockRoomId = "test-room";
  const mockPlayerName = "test-player";
  const mockSocketId = "socket-id-123";

  beforeEach(() => {
    // Setup mocks
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      in: jest.fn().mockReturnThis(),
      fetchSockets: jest.fn().mockResolvedValue([{ id: mockSocketId }]),
    } as unknown as jest.Mocked<Server>;

    socket = {
      id: mockSocketId,
      on: jest.fn(),
      join: jest.fn(),
    } as unknown as jest.Mocked<Socket>;

    redisClient = {} as jest.Mocked<RedisClientType>;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("hostJoin handler", () => {
    it("should register 'hostJoin' event listener", () => {
      handleJoin(io, socket, redisClient);
      expect(socket.on).toHaveBeenCalledWith("hostJoin", expect.any(Function));
    });

    describe("when room exists", () => {
      const mockRoomData = createTestRoom({ gameId: mockRoomId });

      beforeEach(() => {
        mockGetGameRoom.mockResolvedValue(mockRoomData);
        handleJoin(io, socket, redisClient);
        const handler = (socket.on as jest.Mock).mock.calls[0][1];
        handler(mockPlayerName, mockRoomId);
      });

      // it("should update player with socket ID", async () => {
      //   await new Promise(process.nextTick);
      //   expect(mockSetGameRoom).toHaveBeenCalledWith(
      //     redisClient,
      //     mockRoomId,
      //     expect.objectContaining({
      //       players: expect.arrayContaining([
      //         expect.objectContaining(createTestPlayer({ name: mockPlayerName, id: mockSocketId })),
      //       ]),
      //     })
      //   );
      // });

      it("should join the room", async () => {
        await new Promise(process.nextTick);
        expect(socket.join).toHaveBeenCalledWith(mockRoomId);
      });

      it("should emit 'hostJoined' with room data", async () => {
        await new Promise(process.nextTick);
        expect(io.to).toHaveBeenCalledWith(mockSocketId);
        expect(io.emit).toHaveBeenCalledWith("hostJoined", mockRoomData);
      });
    });

    describe("when room doesn't exist", () => {
      beforeEach(() => {
        mockGetGameRoom.mockResolvedValue(null);
        handleJoin(io, socket, redisClient);
        const handler = (socket.on as jest.Mock).mock.calls[0][1];
        handler(mockPlayerName, mockRoomId);
      });

      it("should emit 'hostJoinFailed'", async () => {
        await new Promise(process.nextTick);
        expect(io.to).toHaveBeenCalledWith(mockSocketId);
        expect(io.emit).toHaveBeenCalledWith("hostJoinFailed", mockRoomId);
      });

      it("should not call setGameRoom", async () => {
        await new Promise(process.nextTick);
        expect(mockSetGameRoom).not.toHaveBeenCalled();
      });
    });
  });

  describe("joinRoom handler", () => {
    it("should register 'joinRoom' event listener", () => {
      handleJoin(io, socket, redisClient);
      expect(socket.on).toHaveBeenCalledWith("joinRoom", expect.any(Function));
    });

    describe("when room exists", () => {
      // const mockRoomData = createTestRoom({ gameId: mockRoomId });
      // beforeEach(() => {
      //   mockGetGameRoom.mockResolvedValue(mockRoomData);
      //   handleJoin(io, socket, redisClient);
      //   const handler = (socket.on as jest.Mock).mock.calls[1][1];
      //   handler(mockRoomId, mockPlayerName);
      // });
      // it("should add new player to room", async () => {
      //   await new Promise(process.nextTick);
      //   expect(mockNewPlayerObject).toHaveBeenCalledWith(
      //     mockPlayerName,
      //     mockSocketId,
      //     mockRoomData.timeLimit
      //   );
      //   expect(mockSetGameRoom).toHaveBeenCalledWith(
      //     redisClient,
      //     mockRoomId,
      //     expect.objectContaining({
      //       players: expect.arrayContaining([
      //         expect.objectContaining({
      //           name: mockPlayerName,
      //           id: mockSocketId,
      //         }),
      //       ]),
      //     })
      //   );
      // });
      // it("should join the room", async () => {
      //   await new Promise(process.nextTick);
      //   expect(socket.join).toHaveBeenCalledWith(mockRoomId);
      // });
      // it("should emit 'playerJoined' to room", async () => {
      //   await new Promise(process.nextTick);
      //   expect(io.to).toHaveBeenCalledWith(mockRoomId);
      //   expect(io.emit).toHaveBeenCalledWith("playerJoined", expect.any(Object));
      // });
      // it("should fetch sockets in room", async () => {
      //   await new Promise(process.nextTick);
      //   expect(io.in).toHaveBeenCalledWith(mockRoomId);
      //   expect(io.fetchSockets).toHaveBeenCalled();
      // });
    });

    describe("when room doesn't exist", () => {
      beforeEach(() => {
        mockGetGameRoom.mockResolvedValue(null);
        handleJoin(io, socket, redisClient);
        const handler = (socket.on as jest.Mock).mock.calls[1][1];
        handler(mockRoomId, mockPlayerName);
      });

      it("should emit 'joinFailed' with 'Room not found'", async () => {
        await new Promise(process.nextTick);
        expect(io.to).toHaveBeenCalledWith(mockSocketId);
        expect(io.emit).toHaveBeenCalledWith("joinFailed", "Room not found");
      });
    });

    describe("when player name is taken", () => {
      const mockRoomData = createTestRoom({
        gameId: mockRoomId,
        players: [createTestPlayer({ id: "other-socket", name: mockPlayerName })],
      });

      beforeEach(() => {
        mockGetGameRoom.mockResolvedValue(mockRoomData);
        handleJoin(io, socket, redisClient);
        const handler = (socket.on as jest.Mock).mock.calls[1][1];
        handler(mockRoomId, mockPlayerName);
      });

      it("should emit 'joinFailed' with 'Name not available'", async () => {
        await new Promise(process.nextTick);
        expect(io.to).toHaveBeenCalledWith(mockSocketId);
        expect(io.emit).toHaveBeenCalledWith("joinFailed", "Name not available");
      });

      it("should not add player to room", async () => {
        await new Promise(process.nextTick);
        expect(mockSetGameRoom).not.toHaveBeenCalled();
      });
    });
  });
});
