import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages'de repo adı base path olarak gerekiyor.
// Repo adınızı buraya yazın, örn: "/ogrenci-dekanlik"
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "ogrenci-dekanlik";

export default defineConfig({
  base: GITHUB_REPO_NAME ? `/${GITHUB_REPO_NAME}/` : "/",
  plugins: [react(), tailwindcss()],
});
