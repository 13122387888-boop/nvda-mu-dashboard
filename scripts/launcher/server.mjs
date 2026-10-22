import http from "node:http";
import { spawn, execFile } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const port = 43187;
const origin = "http://127.0.0.1:" + port;
const token = randomBytes(32).toString("hex");
const state = {
  app: "eod-radar-launcher",
  running: false,
  phase: "idle",
  logs: [],
  result: null,
  startedAt: null,
  finishedAt: null,
  health: null,
};
function log(message) {
  state.logs.push({
    time: new Date().toISOString(),
    message: message
      .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi, "[地址已隐藏]")
      .replace(/(apikey|password|authorization)[=:]\S+/gi, "$1=[已隐藏]")
      .slice(0, 1500),
  });
  if (state.logs.length > 250) state.logs.shift();
}
async function health() {
  try {
    const response = await fetch(
      "https://eodradar.com/api/health?launcher=" + Date.now(),
      { signal: AbortSignal.timeout(20000) },
    );
    const h = await response.json();
    state.health = {
      date: h.asOf ?? null,
      count: h.currentStockSymbols ?? 0,
      total: h.expectedSymbols ?? 0,
      source: h.source ?? null,
      status: h.status,
    };
  } catch {
    state.health = { error: "暂时无法检查线上状态，可稍后重试。" };
  }
}
function open() {
  if (process.env.EOD_LAUNCHER_NO_OPEN !== "1")
    execFile("rundll32.exe", ["url.dll,FileProtocolHandler", origin], () => {});
}
function refresh() {
  if (state.running) return false;
  state.running = true;
  state.phase = "running";
  state.logs = [];
  state.result = null;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  log("开始获取最近完整收盘日的长桥数据，校验后统一写入。");
  const cli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(cli)) {
    state.running = false;
    state.phase = "error";
    log("项目依赖不存在，请联系维护者修复。");
    return true;
  }
  const child = spawn(
    process.execPath,
    [cli, "scripts/sync.ts", "incremental"],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let pending = "";
  child.stdout.on("data", (data) => {
    pending += data.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("[RESULT] ")) {
        try {
          state.result = JSON.parse(line.slice(9));
        } catch {
          /* ignore non-result output */
        }
      } else if (line.startsWith("[FETCH] ")) {
        const match = line.match(/^\[FETCH\] (\S+) (\d+)/);
        log(match ? match[1] + "：已获取 " + match[2] + " 根日线" : line);
      } else if (line.trim()) log(line);
    }
  });
  child.stderr.on("data", (data) => log(data.toString()));
  child.on("error", (error) => {
    log(error.message);
    state.running = false;
    state.phase = "error";
    state.finishedAt = new Date().toISOString();
  });
  child.on("close", async (code) => {
    state.running = false;
    state.phase = code === 0 && state.result ? "success" : "error";
    state.finishedAt = new Date().toISOString();
    log(
      state.phase === "success"
        ? "刷新完成：" +
            state.result.tradeDate +
            "，" +
            state.result.symbolCount +
            " 个代码及指标已对齐。"
        : "刷新未完成，请查看上方记录后重试。",
    );
    if (state.phase === "success") await health();
  });
  return true;
}
function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
const server = http.createServer(async (request, response) => {
  if (request.headers.host !== "127.0.0.1:" + port) {
    json(response, 403, { error: "Invalid host" });
    return;
  }
  const url = new URL(request.url, origin);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  if (request.method === "GET" && url.pathname === "/api/status") {
    json(response, 200, state);
    return;
  }
  if (request.method === "POST") {
    const supplied = Buffer.from(request.headers["x-launcher-token"] ?? "");
    const expected = Buffer.from(token);
    if (
      request.headers.origin !== origin ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      json(response, 403, { error: "请从桌面启动器操作。" });
      return;
    }
    if (url.pathname === "/api/refresh") {
      json(response, state.running ? 409 : 202, { started: refresh() });
      return;
    }
    if (url.pathname === "/api/check") {
      await health();
      json(response, 200, state.health);
      return;
    }
  }
  const assets = {
    "/": ["index.html", "text/html"],
    "/app.js": ["app.js", "text/javascript"],
    "/style.css": ["style.css", "text/css"],
  };
  if (request.method === "GET" && assets[url.pathname]) {
    const [file, type] = assets[url.pathname];
    const content = readFileSync(path.join(directory, file), "utf8").replace(
      "__LAUNCHER_TOKEN__",
      token,
    );
    response.writeHead(200, {
      "Content-Type": type + "; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(content);
    return;
  }
  json(response, 404, { error: "Not found" });
});
server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    try {
      const response = await fetch(origin + "/api/status", {
        signal: AbortSignal.timeout(3000),
      });
      const h = await response.json();
      if (h.app === "eod-radar-launcher") {
        open();
        return;
      }
    } catch {}
  }
  console.error("启动器无法启动：" + error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log("EOD Radar launcher: " + origin);
  open();
  void health();
});
