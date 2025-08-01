import { Socket } from "socket.io";

export const handleSocketError = (socket: Socket, message: string, error: any) => {
  console.error("Socket error:", error);
  socket.emit("error", {
    message,
    code: error.code || "UNKNOWN_ERROR",
  });
};
