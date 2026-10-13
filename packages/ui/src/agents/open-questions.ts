import { createContext, useContext } from "react";

export type OpenQuestions = (projectId: string, questionId?: string) => void;

const OpenQuestionsContext = createContext<OpenQuestions | null>(null);

export const OpenQuestionsProvider = OpenQuestionsContext.Provider;

export function useOpenQuestions(): OpenQuestions | null {
  return useContext(OpenQuestionsContext);
}
