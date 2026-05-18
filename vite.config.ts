import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      "process.env.EXPO_PUBLIC_SUPABASE_URL": JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL ?? ""),
      "process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "")
    },
    resolve: {
      alias: {
        "lucide-react-native": "lucide-react",
        "react-native": "react-native-web"
      }
    }
  };
});
