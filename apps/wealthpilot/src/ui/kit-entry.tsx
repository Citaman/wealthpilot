import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts";
import "./tokens.css";
import "./base.css";
import { Kit } from "./Kit";

// Stand-in for the shell dock so auto-scroll and scroll-padding can be tested.
function FakeDock() {
  return (
    <div
      aria-hidden
      ref={(element) => {
        if (!element) return;
        const observer = new ResizeObserver(() =>
          document.documentElement.style.setProperty(
            "--dock-h",
            `${element.offsetHeight + 16}px`,
          ),
        );
        observer.observe(element);
        return () => observer.disconnect();
      }}
      style={{
        position: "fixed",
        bottom: 8,
        left: "50%",
        translate: "-50% 0",
        zIndex: "var(--z-dock)" as unknown as number,
        height: 60,
        width: "min(640px, calc(100vw - 16px))",
        borderRadius: "var(--r-dock)",
        background: "var(--dock-bg)",
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Kit />
    <FakeDock />
  </StrictMode>,
);
