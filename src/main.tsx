import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/fonts";
import "./ui/tokens.css";
import "./ui/base.css";
import { App } from "./app/App";

async function start() {
  // Dev-only fictional household for QA; never touches a non-empty database.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo"))
    await (await import("./dev/demo")).loadDemoIfEmpty();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start();
