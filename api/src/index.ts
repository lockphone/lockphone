import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
const { app, database } = await buildServer({ config, pool });

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
  process.exit(0);
};

process.on("SIGTERM", () => void close("SIGTERM"));
process.on("SIGINT", () => void close("SIGINT"));

await app.listen({ host: "0.0.0.0", port: config.PORT });

