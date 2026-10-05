import { createContext, useContext } from "react";
import type { BoardInstance } from "./layout";
export const BoardInstanceContext = createContext<{
  instance: BoardInstance;
  update: (change: Partial<BoardInstance>) => Promise<void>;
} | null>(null);
export const useBoardInstance = () => useContext(BoardInstanceContext);
