const token = document.querySelector('meta[name="launcher-token"]').content;
const date = document.getElementById("date"),
  count = document.getElementById("count"),
  refresh = document.getElementById("refresh"),
  check = document.getElementById("check"),
  phase = document.getElementById("phase"),
  result = document.getElementById("result"),
  logs = document.getElementById("logs"),
  activity = document.getElementById("activity");
let lastLogs = "",
  busy = false;
async function post(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-launcher-token": token },
  });
  if (!response.ok)
    throw new Error((await response.json()).error ?? "操作未完成");
  return response.json();
}
async function update() {
  try {
    const response = await fetch("/api/status");
    const state = await response.json();
    busy = state.running;
    refresh.disabled = busy;
    refresh.textContent = busy ? "正在刷新，请稍候…" : "刷新数据 ↻";
    activity.classList.toggle("running", busy);
    phase.textContent =
      {
        idle: "准备就绪",
        running: "正在刷新",
        success: "刷新成功",
        error: "刷新未完成",
      }[state.phase] ?? "准备就绪";
    phase.dataset.state = state.phase;
    result.textContent = state.result
      ? state.result.tradeDate + " · " + state.result.symbolCount + " 个代码"
      : busy
        ? "获取行情 → 校验 → 更新指标"
        : "点击“刷新数据”开始";
    if (state.health) {
      date.textContent = state.health.date ?? "暂时无法读取";
      count.textContent = state.health.total
        ? state.health.count + " / " + state.health.total
        : "—";
    }
    const next = JSON.stringify(state.logs);
    if (state.logs.length && next !== lastLogs) {
      lastLogs = next;
      logs.replaceChildren(
        ...state.logs.map((entry) => {
          const p = document.createElement("p");
          p.textContent =
            new Date(entry.time).toLocaleTimeString("zh-CN", {
              hour12: false,
            }) +
            "  " +
            entry.message;
          return p;
        }),
      );
      logs.scrollTop = logs.scrollHeight;
    }
  } catch {
    phase.textContent = "启动器连接已断开，请重新双击桌面图标。";
    refresh.disabled = true;
  }
}
refresh.addEventListener("click", async () => {
  if (busy) return;
  refresh.disabled = true;
  try {
    await post("/api/refresh");
    await update();
  } catch (error) {
    phase.textContent = error.message;
    refresh.disabled = false;
  }
});
check.addEventListener("click", async () => {
  check.disabled = true;
  check.textContent = "检查中…";
  try {
    await post("/api/check");
    await update();
  } catch (error) {
    phase.textContent = error.message;
  } finally {
    check.disabled = false;
    check.textContent = "检查状态 ↻";
  }
});
void update();
setInterval(update, 1200);
