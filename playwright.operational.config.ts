import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/operational",
  testMatch: "**/*.operational.ts",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3104",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: [
    {
      command: "node --import tsx tests/fixtures/supabase-server.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3104",
      url: "http://127.0.0.1:3104",
      reuseExistingServer: false,
      env: {
        SUPABASE_INTEGRATION_ENABLED: "true",
        SUPABASE_URL: "http://127.0.0.1:54329",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_fixture",
        APP_ORIGIN: "http://127.0.0.1:3104",
        ELECTORAL_DEPLOYMENT_STAGE: "local-test",
        ELECTORAL_DEMO_ENABLED: "false",
        ELECTORAL_RPC_VOTING_ENABLED: "false",
        ELECTORAL_OFFICIAL_VOTING_ENABLED: "false",
        ELECTORAL_SUPERVISED_DNI_ENABLED: "false",
        VERCEL: "0",
      },
    },
  ],
});
