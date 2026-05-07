/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const net = require("net");

const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const parsed = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

const fileEnv = readEnvFile(envPath);

function getEnv(key) {
  return process.env[key] ?? fileEnv[key];
}

if (getEnv("SKIP_DB_CHECK") === "1") {
  console.log("Database check skipped (SKIP_DB_CHECK=1).");
  process.exit(0);
}

const databaseUrl = getEnv("DATABASE_URL");
const requireDb = getEnv("REQUIRE_DB") === "1";
const timeoutMs = Number(getEnv("DB_CHECK_TIMEOUT_MS") || "3000");

let host = getEnv("DATABASE_HOST") || "localhost";
let port = Number(getEnv("DATABASE_PORT") || "5432");

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    host = url.hostname;
    port = url.port ? Number(url.port) : port;
  } catch (err) {
    console.warn("Invalid DATABASE_URL, falling back to DATABASE_HOST/PORT:", err);
  }
}

console.log(`Checking PostgreSQL at ${host}:${port}...`);

const socket = net.createConnection({ host, port });
const timer = setTimeout(() => {
  socket.destroy(new Error("DB_CHECK_TIMEOUT"));
}, timeoutMs);

socket.on("connect", () => {
  clearTimeout(timer);
  socket.end();
  console.log("Database reachable.");
});

socket.on("error", (err) => {
  clearTimeout(timer);
  console.warn("Database not reachable:", err.message);
  console.warn("Start PostgreSQL or run: docker compose up -d postgres");

  if (requireDb) {
    process.exitCode = 1;
  }
});
