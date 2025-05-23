export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type TimeLimit = "15" | "30" | "45" | "60";
export type JoinFailedReason = "Room not found" | "Name not available";

export type CreateRoomBody = {
  playerName: string;
  numQuestions: number;
  categoryId: number;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
};

export type JoinRoomBody = {
  playerName: string;
  roomId: string;
};

export type TriviaResponse = {
  response_code: number;
  results: QuestionResponse[];
};

export type QuestionResponse = {
  type: "multiple" | "boolean";
  difficulty: Difficulty;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

export type Question = {
  type: "multiple" | "boolean";
  difficulty: Difficulty;
  category: string;
  question: string;
  correct_answer: string;
  all_answers: string[];
};

export type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  correctAnswers: number;
  totalAnswers: number;
  fastestAnswer: number;
};

export type Message = {
  message: string;
  user: string;
};

export type RoomData = {
  gameId: string;
  players: Player[];
  host: string;
  questions: Question[];
  messages: Message[];
  currentQuestion: number;
  gameStarted: boolean;
  category: number;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
};

type SocketSendEvents = {
  hostJoin: (playerName: string, roomId: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  submitAnswer: (roomId: string, playerName: string, points: number, answerTime: number) => void;
  sendMessage: (roomId: string, message: string, playerName: string) => void;
  nextQuestion: (roomId: string, playerName: string) => void;
  startGame: (roomId: string) => void;
  disconnect: () => void;
  reconnect: (roomId: string, playerName: string) => void;
};

type SocketResponseEvents = {
  hostJoinFailed: (roomId: string) => void;
  hostJoined: (data: RoomData) => void;
  playerJoined: (data: RoomData) => void;
  updatePlayerScore: (playerName: string, score: number) => void;
  joinFailed: (reason: JoinFailedReason) => void;
  receivedMessage: (message: string, playerName: string) => void;
  nextQuestion: (currentQuestion: number) => void;
  gameStarted: () => void;
  gameEnd: () => void;
  reconnected: (data: RoomData) => void;
  reconnectFailed: (reason: string) => void;
  allAnswered: () => void;
};

declare module "socket.io" {
  // @ts-expect-error not fixing
  interface Socket {
    // Add your custom event types here
    on<T extends keyof SocketSendEvents>(event: T, listener: SocketSendEvents[T]): this;
    emit<T extends keyof SocketResponseEvents>(event: T, ...args: Parameters<SocketResponseEvents[T]>): this;
  }
}
