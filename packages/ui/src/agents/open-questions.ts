import { createContext, useContext } from "react";

const OpenQuestionsContext = createContext<((projectId: string) => void) | null>(null);

export const OpenQuestionsProvider = OpenQuestionsContext.Provider;

export function useOpenQuestions(): ((projectId: string) => void) | null {
  return useContext(OpenQuestionsContext);
}
