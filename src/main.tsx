import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { WorldProvider } from "./context/WorldContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <WorldProvider>
        <App />
      </WorldProvider>
    </AuthProvider>
  </React.StrictMode>
);
