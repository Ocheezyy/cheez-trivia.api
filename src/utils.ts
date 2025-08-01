import { CreateRoomBody, Difficulty, Player, Question, RoomData, TriviaResponse } from "./types";
import { RedisClientType } from "redis";

const GAME_ROOM_KEY = process.env.GAME_ROOM_KEY!;

export async function fetchTriviaQuestions(
  numQuestions?: number,
  category?: number,
  difficulty?: Difficulty
) {
  const url = buildTriviaUrl(numQuestions, category, difficulty);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch trivia questions: ");

  const data: TriviaResponse = await response.json();
  const questions: Question[] = data.results.map((question) => {
    return {
      question: question.question,
      type: question.type,
      difficulty: question.difficulty,
      category: question.category,
      correct_answer: question.correct_answer,
      all_answers: shuffleArray([question.correct_answer, ...question.incorrect_answers]),
    };
  });
  return questions;
}

export function buildTriviaUrl(numQuestions?: number, category?: number, difficulty?: Difficulty) {
  let url = "https://opentdb.com/api.php?";

  if (numQuestions) url = url + `amount=${numQuestions}&`;
  if (category) url = url + `category=${category}&`;
  if (difficulty) url = url + "difficulty=medium";

  if (url.endsWith("&")) url = url.substring(0, url.length - 1);
  return url;
}

function shuffleArray(array: string[]): string[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

function generateRandomLetterString() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
}

export async function createRoomId(redisClient: RedisClientType) {
  let attempts = 0;
  const MAX_ATTEMPTS = 200;

  while (attempts < MAX_ATTEMPTS) {
    let roomId = generateRandomLetterString();
    const roomString = await redisClient.hGet(GAME_ROOM_KEY, roomId);

    if (!roomString) {
      return roomId;
    }
    attempts++;
  }

  throw new Error("Failed to get a unique room ID");
}

export function newPlayerObject(playerName: string, socketId: string, timeLimit: string): Player {
  return {
    id: socketId,
    name: playerName,
    score: 0,
    hasAnswered: false,
    fastestAnswer: Number(timeLimit),
    correctAnswers: 0,
    totalAnswers: 0,
  };
}

export function createRoomData(body: CreateRoomBody, roomId: string, questions: Question[]) {
  const roomData: RoomData = {
    gameId: roomId,
    players: [newPlayerObject(body.playerName, "", body.timeLimit)],
    questions: questions,
    host: body.playerName,
    messages: [],
    currentQuestion: 1,
    gameStarted: false,
    category: body.categoryId,
    difficulty: body.difficulty,
    timeLimit: body.timeLimit,
  };
  return roomData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isValidRoomData = (data: any): data is RoomData => {
  return (
    data &&
    typeof data.gameId === "string" &&
    Array.isArray(data.players) &&
    typeof data.currentQuestion === "number"
  );
};
