import signalR from "@microsoft/signalr";
import crypto from "crypto";
import readline from "node:readline";

const API_BASE_URL = "https://api.resonite.com";
const SESSION_CACHE_INTERVAL_MILLISECONDS = 10000;
const MAX_CONNECTION_RETRIES = 5;

class ApiClient {
  constructor() {
    this.machineId = crypto.randomBytes(32).toString("base64url");
    this.uid = this.sha256(this.machineId);
    this.sessionToken = null;
    this.userId = null;
    this.secretMachineId = crypto.randomUUID();
  }

  sha256(s) {
    const hash = crypto.createHash("sha256");
    hash.update(s);
    return hash.digest().toString("hex");
  }

  async request(url, init = {}) {
    const initobj = {
      ...init,
      headers: {
        ...init.headers,
        UID: this.uid,
        Authorization: this.sessionToken ? this.authorization() : undefined,
      },
    };
    return fetch(url, initobj);
  }

  async login(identity, password) {
    const loginCredentials = {
      ownerId: null,
      email: null,
      userName: null,
      authentication: { $type: "password", password },
      secretMachineId: this.secretMachineId,
      rememberMe: false,
    };

    if (identity.startsWith("U-")) {
      loginCredentials.ownerId = identity;
    } else if (identity.indexOf("@") > 0) {
      loginCredentials.email = identity;
    } else {
      loginCredentials.userName = identity;
    }

    const result = await this.request(`${API_BASE_URL}/userSessions`, {
      method: "POST",
      body: JSON.stringify(loginCredentials),
      headers: { "Content-Type": "application/json" },
    });

    if (result.status !== 200) {
      return null;
    }

    const userSessionResult = await result.json();
    this.userId = userSessionResult.entity.userId;
    this.sessionToken = userSessionResult.entity.token;
    return userSessionResult;
  }

  async logout() {
    if (!this.sessionToken) return;

    const result = await this.request(
      `${API_BASE_URL}/userSessions/${this.userId}/${this.sessionToken}`,
      { method: "DELETE" }
    );
    console.log(result.status + " " + result.statusText);
  }

  authorization() {
    return this.sessionToken
      ? "res " + this.userId + ":" + this.sessionToken
      : null;
  }
}

let sessionCache = [];
const friends = {};

function getActiveWorldFromCache(userId) {
  for (let session of sessionCache) {
    for (let user of session.sessionUsers) {
      if (user.userID === userId && user.isPresent) {
        return session.name;
      }
    }
  }

  return null;
}

async function updateSessionCache() {
  const sessionsResponse = await fetch(
    `${API_BASE_URL}/sessions?includeEmptyHeadless=false&minActiveUsers=1`
  );

  if (!sessionsResponse.ok) {
    throw new Error("Failed to fetch sessions.");
  }

  sessionCache = await sessionsResponse.json();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  const client = new ApiClient();

  // Read credentials from file for automated testing
  let id, password;
  try {
    const fs = await import('fs');
    const credentials = fs.readFileSync('./credential', 'utf8').trim().split('\n');
    id = credentials[0].split('=')[1];
    password = credentials[1].split('=')[1];
    console.log(`[NODE.JS DEBUG] Using credentials from file: ${id}`);
  } catch (e) {
    const id = await question("Enter your ID: ");
    const password = await question("Enter your password: ");
  }

  const loginResult = (await client.login(id, password))?.entity;

  if (!loginResult) {
    console.log("[NODE.JS DEBUG] Login error");
    process.exit(1);
  }

  console.log("[NODE.JS DEBUG] Login successful, User ID:", loginResult.userId);

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hub`, {
      headers: { Authorization: client.authorization() },
    })
    .configureLogging(signalR.LogLevel.Trace) // Changed to Trace for maximum logs
    .build();

  console.log("[NODE.JS DEBUG] SignalR connection created")

  connection.on("debug", (message) => {
    console.log("[NODE.JS DEBUG] Received debug message:", JSON.stringify(message));
  });

  connection.on("receivesessionupdate", (message) => {
    console.log("[NODE.JS DEBUG] Received receivesessionupdate");
  });

  connection.on("removesession", (message) => {
    console.log("[NODE.JS DEBUG] Received removesession");
  });

  connection.on("sendstatustouser", (message) => {
    console.log("[NODE.JS DEBUG] Received sendstatustouser:", JSON.stringify(message));
  });

  connection.on("receivestatusupdate", async (message) => {
    console.log("[NODE.JS DEBUG] ===== RECEIVESTATUSUPDATE EVENT =====");
    console.log("[NODE.JS DEBUG] Raw message:", JSON.stringify(message, null, 2));
    
    const currentWorld = getActiveWorldFromCache(message.userId);
    message.userId = message.userId.replace("U-", "");

    friends[message.userId] = {
      Status: message.onlineStatus,
      "World Name": currentWorld || "Private",
    };
    console.table(friends);
    console.log("[NODE.JS DEBUG] ===== END RECEIVESTATUSUPDATE =====");
  });

  const sessionUpdateIntervalId = setInterval(
    updateSessionCache,
    SESSION_CACHE_INTERVAL_MILLISECONDS
  );

  let isConnected = false;
  for (let i = 0; i < MAX_CONNECTION_RETRIES; i++) {
    try {
      await connection.start();
      isConnected = true;
      console.log("[NODE.JS DEBUG] Connected to SignalR hub successfully.");
      break; // If connected successfully, exit the loop
    } catch (error) {
      console.error(
        `[NODE.JS DEBUG] Failed to connect. Retrying in 5 seconds... (${
          i + 1
        }/${MAX_CONNECTION_RETRIES} attempts)`, error
      );
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }

  if (!isConnected) {
    console.error("[NODE.JS DEBUG] Connection failed. Please try again after some time.");
    process.exit(1);
  }

  console.log("[NODE.JS DEBUG] Calling InitializeStatus...");
  await connection.invoke("InitializeStatus");
  console.log("[NODE.JS DEBUG] InitializeStatus called");
  
  console.log("[NODE.JS DEBUG] Updating session cache...");
  await updateSessionCache();
  console.log("[NODE.JS DEBUG] Session cache updated");
  
  console.log("[NODE.JS DEBUG] Calling RequestStatus...");
  await connection.invoke("RequestStatus", null, false);
  console.log("[NODE.JS DEBUG] RequestStatus called");
  
  // Wait a bit and try additional subscriptions that might be needed
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log("[NODE.JS DEBUG] Attempting additional friend status requests...");
  try {
    await connection.invoke("SubscribeToFriendStatuses");
    console.log("[NODE.JS DEBUG] SubscribeToFriendStatuses called");
  } catch (e) {
    console.log("[NODE.JS DEBUG] SubscribeToFriendStatuses failed:", e.message);
  }
  
  try {
    await connection.invoke("RequestFriendStatus");
    console.log("[NODE.JS DEBUG] RequestFriendStatus called");
  } catch (e) {
    console.log("[NODE.JS DEBUG] RequestFriendStatus failed:", e.message);
  }

  // Auto-stop after 30 seconds for testing
  setTimeout(async () => {
    console.log("\n[NODE.JS DEBUG] [AUTO-STOP] Stopping after 30 seconds for testing...");
    clearInterval(sessionUpdateIntervalId);
    await connection.stop();
    await client.logout();
    rl.close();
    process.exit(0);
  }, 30000);

  rl.question("Enter to stop\n", async (answer) => {
    clearInterval(sessionUpdateIntervalId);
    await connection.stop();
    await client.logout();
    rl.close();
  });
}

main();