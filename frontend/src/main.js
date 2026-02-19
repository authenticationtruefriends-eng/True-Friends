import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CallProvider } from "./call/CallContext";

// ✅ Put your logged-in userId here
const userId = localStorage.getItem("userId"); // or from your auth state

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CallProvider userId={userId}>
      <App />
    </CallProvider>
  </React.StrictMode>
);
