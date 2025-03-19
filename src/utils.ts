import { Difficulty, TriviaResponse } from "./types";

export async function fetchTriviaQuestions(
  numQuestions?: number,
  category?: number,
  difficulty?: Difficulty
) {
  const url = buildTriviaUrl(numQuestions, category, difficulty);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch trivia questions");
  const data: TriviaResponse = await response.json();
  return data.results;
}

export function buildTriviaUrl(numQuestions?: number, category?: number, difficulty?: Difficulty) {
  let url = "https://opentdb.com/api.php?amount=10&category=23&difficulty=medium";

  if (numQuestions) url = url + `amount=${numQuestions}&`;
  if (category) url = url + `category=${category}&`;
  if (difficulty) url = url + "difficulty=medium";

  if (url.endsWith("&")) url = url.substring(0, url.length - 1);
  return url;
}
