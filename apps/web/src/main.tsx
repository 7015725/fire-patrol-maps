import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./i18n";
import "./styles/theme.css";
import { applyUiPrefs, loadUiPrefs } from "./lib/uiPrefs";

applyUiPrefs(loadUiPrefs());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
