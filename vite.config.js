import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages'de repo adı base path olarak gerekiyor.
// Yerel geliştirmede "/" kalır; workflow repo adını ortam değişkeniyle verir.
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

export default defineConfig({
  base: GITHUB_REPO_NAME ? `/${GITHUB_REPO_NAME}/` : "/",
  plugins: [react(), tailwindcss()],
});
