import type { Difficulty, Question, TriviaResponse } from "./types";

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
  console.log("Trivia url: " + url);
  return url;
}

function shuffleArray(array: string[]): string[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}
