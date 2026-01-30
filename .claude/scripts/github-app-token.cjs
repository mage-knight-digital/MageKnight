#!/usr/bin/env node

/**
 * GitHub App Token Generator
 *
 * Generates installation access tokens for the MageKnight GitHub App.
 * Tokens are cached for 50 minutes (they last 1 hour).
 *
 * Usage:
 *   node github-app-token.cjs          # Get token (uses cache)
 *   node github-app-token.cjs --fresh  # Force new token
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

// === Configuration ===
const APP_ID = "2757865";
const INSTALLATION_ID = "106903250"; // mage-knight-digital org
const PRIVATE_KEY_PATH = path.join(process.env.HOME, ".config/github/mage-knight-app.pem");
const CACHE_DIR = path.join(process.env.HOME, ".claude-cache", "mage-knight");
const TOKEN_CACHE_FILE = path.join(CACHE_DIR, "app-token.json");
const TOKEN_TTL = 50 * 60 * 1000; // 50 minutes (tokens last 1 hour)

// === JWT Generation ===

function base64url(data) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createJWT(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iat: now - 60,      // Issued 60 seconds ago (clock drift)
    exp: now + 600,     // Expires in 10 minutes
    iss: appId
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsigned}.${signature}`;
}

// === HTTP Request ===

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// === Token Generation ===

async function getInstallationToken(jwt, installationId) {
  const options = {
    hostname: "api.github.com",
    path: `/app/installations/${installationId}/access_tokens`,
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mage-knight-claude-automation",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  };

  const response = await httpsRequest(options);
  return response.token;
}

// === Cache Management ===

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachedToken() {
  if (!fs.existsSync(TOKEN_CACHE_FILE)) {
    return null;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
    if (Date.now() - cache.timestamp < TOKEN_TTL) {
      return cache.token;
    }
  } catch {
    // Cache corrupted
  }

  return null;
}

function cacheToken(token) {
  ensureCacheDir();
  fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({
    timestamp: Date.now(),
    token
  }));
}

// === Main ===

async function main() {
  const args = process.argv.slice(2);
  const forceFresh = args.includes("--fresh");

  // Check cache first
  if (!forceFresh) {
    const cached = getCachedToken();
    if (cached) {
      console.log(cached);
      return;
    }
  }

  // Read private key
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`Private key not found at ${PRIVATE_KEY_PATH}`);
    process.exit(1);
  }
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf-8");

  // Generate JWT
  const jwt = createJWT(APP_ID, privateKey);

  // Exchange for installation token
  try {
    const token = await getInstallationToken(jwt, INSTALLATION_ID);
    cacheToken(token);
    console.log(token);
  } catch (error) {
    console.error("Failed to get installation token:", error.message);
    process.exit(1);
  }
}

main();
