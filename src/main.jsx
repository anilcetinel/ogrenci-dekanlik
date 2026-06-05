import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import PinGate from "./components/PinGate";
import "./index.css";

const routerBasename =
  import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PinGate>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </PinGate>
  </React.StrictMode>,
);
