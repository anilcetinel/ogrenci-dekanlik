import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import PinGate from "./components/PinGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PinGate>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PinGate>
  </React.StrictMode>,
);
