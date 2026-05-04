import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";
import "./AppShell.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
