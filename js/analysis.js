/* ============================================================
 * AI漫剧编剧人格测试 - 数据统计与可视化
 * 纯原生 SVG / CSS 实现，无需外部依赖，支持离线演示
 * ============================================================ */

const LETTERS = ["A", "B", "C", "D"];

function renderAnalysis() {
  const records = loadRecords();
  renderKpis(records);
  renderDonut(records);
  renderTagRank(records);
  renderChannel(records);
  renderSceneBars(records);
  renderQuestionSummary(records);
  renderInsights(records);
}

/* ---------- 统计工具 ---------- */
function countTypes(records) {
  const c = { F: 0, M: 0, T: 0, W: 0 };
  records.forEach((r) => { if (c[r.type] !== undefined) c[r.type]++; });
  return c;
}

/* 返回 [题][选项] 的选择次数矩阵（基于实际抽到的题） */
function countOptions(records) {
  const m = QUESTIONS.map((q) => q.options.map(() => 0));
  records.forEach((r) => {
    const qids = r.qids || [];
    (r.picks || []).forEach((a, i) => {
      const qi = qids[i];
      if (qi == null) return;
      if (a >= 0 && m[qi] && m[qi][a] !== undefined) m[qi][a] += 1;
    });
  });
  return m;
}

/* 统计被选中的题材标签次数 */
function countTags(records) {
  const c = {};
  records.forEach((r) => (r.tags || []).forEach((t) => { c[t] = (c[t] || 0) + 1; }));
  return c;
}

function maxOptionOf(row) {
  let bi = 0;
  row.forEach((n, i) => { if (n > row[bi]) bi = i; });
  return bi;
}

/* ---------- KPI 卡片 ---------- */
function renderKpis(records) {
  const box = document.getElementById("kpi-cards");
  if (!records.length) {
    box.innerHTML = `<div class="empty-tip">暂无问卷数据：先完成一次测试，或点击下方「载入示例数据」查看演示效果。</div>`;
    return;
  }
  const typeCount = countTypes(records);
  const topType = TYPE_ORDER.reduce((a, b) => (typeCount[a] >= typeCount[b] ? a : b));
  const t = TYPES[topType];
  const tagCount = countTags(records);
  const tagList = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const topTag = tagList[0] || ["—", 0];
  const totalTags = tagList.reduce((a, [, n]) => a + n, 0) || 1;

  box.innerHTML = `
    <div class="kpi"><div class="kpi-num">${records.length}</div><div class="kpi-label">有效问卷份数</div></div>
    <div class="kpi"><div class="kpi-num">${records.length * QUIZ_SIZE}</div><div class="kpi-label">有效选择总数（每份 ${QUIZ_SIZE} 题，抽自 ${POOL_SIZE} 题库）</div></div>
    <div class="kpi" style="border-color:${t.color}">
      <div class="kpi-num">${t.emoji} ${t.name}</div>
      <div class="kpi-label">占比最高的风格参考（${Math.round((typeCount[topType] / records.length) * 100)}%）</div>
    </div>
    <div class="kpi">
      <div class="kpi-num kpi-small">${topTag[0]}</div>
      <div class="kpi-label">最热题材标签（被选 ${topTag[1]} 次 · 占 ${Math.round((topTag[1] / totalTags) * 100)}%）</div>
    </div>
  `;
}

/* ---------- 甜甜圈图：编剧类型占比 ---------- */
function renderDonut(records) {
  const box = document.getElementById("donut-chart");
  const legend = document.getElementById("donut-legend");
  if (!records.length) {
    box.innerHTML = `<div class="empty-tip">暂无数据</div>`;
    legend.innerHTML = "";
    return;
  }
  const counts = countTypes(records);
  const total = records.length;
  const R = 78, C = 2 * Math.PI * R;
  let offset = 0;

  const segs = TYPE_ORDER.filter((k) => counts[k] > 0).map((k) => {
    const frac = counts[k] / total;
    const seg = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${TYPES[k].color}"
      stroke-width="30" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}"
      stroke-dashoffset="${(-offset * C).toFixed(2)}"
      transform="rotate(-90 100 100)"></circle>`;
    offset += frac;
    return seg;
  }).join("");

  box.innerHTML = `
    <svg viewBox="0 0 200 200" class="donut">
      ${segs}
      <text x="100" y="94" text-anchor="middle" class="donut-num">${total}</text>
      <text x="100" y="116" text-anchor="middle" class="donut-cap">份样本</text>
    </svg>`;
  legend.innerHTML = TYPE_ORDER.map((k) => {
    const t = TYPES[k];
    const n = counts[k];
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<div class="legend-item">
      <span class="dot" style="background:${t.color}"></span>
      <span class="legend-name">${t.emoji}${t.name}</span>
      <span class="legend-val">${n}人 · ${pct}%</span>
    </div>`;
  }).join("");
}

/* ---------- 题材标签热度榜 ---------- */
function renderTagRank(records) {
  const box = document.getElementById("tag-rank");
  if (!records.length) { box.innerHTML = `<div class="empty-tip">暂无数据</div>`; return; }
  const tagCount = countTags(records);
  const list = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!list.length) { box.innerHTML = `<div class="empty-tip">暂无标签数据</div>`; return; }
  const max = list[0][1];
  const total = Object.values(tagCount).reduce((a, b) => a + b, 0) || 1;

  box.innerHTML = list.map(([name, n], i) => {
    const info = TAG_MAP[name] || { ch: "女", main: "F" };
    return `<div class="rank-row">
      <span class="rank-no ${i < 3 ? "hot" : ""}">${i + 1}</span>
      <span class="rank-name">${name}<em class="opt-ch ch-${info.ch}">${info.ch}频</em></span>
      <div class="rank-track"><i style="width:${(n / max) * 100}%;background:${TYPES[info.main].color}"></i></div>
      <span class="rank-val">${n}次 · ${Math.round((n / total) * 100)}%</span>
    </div>`;
  }).join("");
}

/* ---------- 频道偏好 ---------- */
function renderChannel(records) {
  const box = document.getElementById("channel-panel");
  const withCh = records.filter((r) => r.channel && (r.channel["女"] || r.channel["男"]));
  if (!withCh.length) { box.innerHTML = `<div class="empty-tip">暂无数据</div>`; return; }

  const sumNv = withCh.reduce((a, r) => a + r.channel["女"], 0);
  const sumNan = withCh.reduce((a, r) => a + r.channel["男"], 0);
  const nvPct = Math.round((sumNv / (sumNv + sumNan)) * 100);
  let nvUsers = 0;
  withCh.forEach((r) => { if (r.channel["女"] >= r.channel["男"]) nvUsers++; });
  const nvUserPct = Math.round((nvUsers / withCh.length) * 100);

  box.innerHTML = `
    <div class="ch-block">
      <div class="ch-title">全体样本的选择占比（按频道统计）</div>
      <div class="mix-row">
        <span class="mix-name">👩 女频题材</span>
        <div class="mix-bar"><i style="width:${nvPct}%;background:#ff7fb0"></i></div>
        <span class="mix-pct">${nvPct}%</span>
      </div>
      <div class="mix-row">
        <span class="mix-name">👨 男频题材</span>
        <div class="mix-bar"><i style="width:${100 - nvPct}%;background:#5bb8ff"></i></div>
        <span class="mix-pct">${100 - nvPct}%</span>
      </div>
    </div>
    <div class="ch-block">
      <div class="ch-title">受试者的频道倾向人数</div>
      <div class="mix-row">
        <span class="mix-name">👩 女频向编剧</span>
        <div class="mix-bar"><i style="width:${nvUserPct}%;background:#ff7fb0"></i></div>
        <span class="mix-pct">${nvUsers}人 · ${nvUserPct}%</span>
      </div>
      <div class="mix-row">
        <span class="mix-name">👨 男频向编剧</span>
        <div class="mix-bar"><i style="width:${100 - nvUserPct}%;background:#5bb8ff"></i></div>
        <span class="mix-pct">${withCh.length - nvUsers}人 · ${100 - nvUserPct}%</span>
      </div>
    </div>
    <p class="ch-note">说明：频道得分按「每题该频道选项数量的倒数」加权，保证女频/男频选项数完全相等时的公平比较。</p>`;
}

/* ---------- 情景题选择分布（横向条形图） ---------- */
function renderSceneBars(records) {
  const box = document.getElementById("scene-bars");
  if (!records.length) { box.innerHTML = `<div class="empty-tip">暂无数据</div>`; return; }
  const m = countOptions(records);
  const total = records.length;

  box.innerHTML = QUESTIONS.map((q, qi) => {
    if (q.type !== "scene") return "";
    const max = Math.max(...m[qi], 1);
    const rows = q.options.map((opt, oi) => {
      const n = m[qi][oi];
      const pct = Math.round((n / total) * 100);
      const isTop = n === max && n > 0;
      return `
        <div class="qbar-row ${isTop ? "top" : ""}">
          <span class="qbar-letter" style="--c:${TYPES[opt.t].color}">${LETTERS[oi]}</span>
          <span class="qbar-text">${opt.text}</span>
          <div class="qbar-track"><i style="width:${(n / max) * 100}%;background:${TYPES[opt.t].color}"></i></div>
          <span class="qbar-val">${n}票 · ${pct}%</span>
        </div>`;
    }).join("");
    return `<div class="qbar-card"><div class="qbar-head">${q.scene}</div>${rows}</div>`;
  }).join("");
}

/* ---------- 全部题目最热选项速览 ---------- */
function renderQuestionSummary(records) {
  const box = document.getElementById("q-summary");
  if (!records.length) { box.innerHTML = `<div class="empty-tip">暂无数据</div>`; return; }
  const m = countOptions(records);
  const total = records.length;

  box.innerHTML = QUESTIONS.map((q, qi) => {
    const bi = maxOptionOf(m[qi]);
    const n = m[qi][bi];
    const pct = Math.round((n / total) * 100);
    const opt = q.options[bi];
    return `<div class="qsum-card ${q.type}">
      <div class="qsum-head">
        <span class="qsum-no">第${qi + 1}题</span>
        <span class="qsum-type">${q.type === "scene" ? "情景" : "题材"}</span>
        <span class="qsum-pct" style="color:${TYPES[opt.t].color}">${pct}%</span>
      </div>
      <div class="qsum-q">${q.scene}</div>
      <div class="qsum-opt">${opt.text}</div>
    </div>`;
  }).join("");
}

/* ---------- 自动洞察文案 ---------- */
function renderInsights(records) {
  const box = document.getElementById("insights");
  if (!records.length) { box.innerHTML = ""; return; }

  const counts = countTypes(records);
  const total = records.length;
  const sorted = TYPE_ORDER.slice().sort((a, b) => counts[b] - counts[a]);
  const first = TYPES[sorted[0]], last = TYPES[sorted[3]];

  const tagCount = countTags(records);
  const tagRank = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const topTags = tagRank.slice(0, 3).map(([name]) => name);
  const nvTag = tagRank.filter(([n]) => TAG_MAP[n] && TAG_MAP[n].ch === "女")[0];
  const nanTag = tagRank.filter(([n]) => TAG_MAP[n] && TAG_MAP[n].ch === "男")[0];

  const withCh = records.filter((r) => r.channel);
  let nvPct = 50;
  if (withCh.length) {
    const s1 = withCh.reduce((a, r) => a + r.channel["女"], 0);
    const s2 = withCh.reduce((a, r) => a + r.channel["男"], 0);
    nvPct = Math.round((s1 / (s1 + s2)) * 100);
  }
  const m = countOptions(records);
  const sceneTotals = { F: 0, M: 0, T: 0, W: 0 };
  QUESTIONS.forEach((q, qi) => {
    if (q.type !== "scene") return;
    q.options.forEach((o, oi) => { sceneTotals[o.t] += m[qi][oi]; });
  });
  const sceneSorted = TYPE_ORDER.slice().sort((a, b) => sceneTotals[b] - sceneTotals[a]);

  box.innerHTML = `
    <div class="insight-card">
      <h3>📊 数据解读</h3>
      <ul>
        <li>在 <b>${total}</b> 份有效问卷中，<b style="color:${first.color}">${first.name}</b> 风格的占比最高（${Math.round((counts[sorted[0]] / total) * 100)}%），
          <b style="color:${last.color}">${last.name}</b> 占比最低（${Math.round((counts[sorted[3]] / total) * 100)}%）。<small style="opacity:.7">（四派分类仅供参考，用户画像可能横跨多派。）</small></li>
        <li>在「情景题」部分（剥离具体题材，只看编剧直觉），大众最偏爱
          <b style="color:${TYPES[sceneSorted[0]].color}">${TYPES[sceneSorted[0]].name}</b> 式的桥段，
          说明观众对「${TYPES[sceneSorted[0]].traits[0]}」的诉求最强。</li>
        <li>题材标签方面，被选次数最高的三个标签是 <b>${topTags.join("、")}</b>；
          其中最热的女频标签为 <b>${nvTag ? nvTag[0] : "—"}</b>，最热的男频标签为 <b>${nanTag ? nanTag[0] : "—"}</b>。</li>
        <li>整体选择中女频题材占 <b>${nvPct}%</b>、男频题材占 <b>${100 - nvPct}%</b>，
          反映出本次样本对
          ${nvPct > 55 ? "女频情感向内容" : nvPct < 45 ? "男频成长向内容" : "女频与男频内容"} 的偏好更强。</li>
        <li>建议：AI 漫剧创作可把「${TYPES[sorted[0]].name}」的情绪结构，嫁接在热度最高的题材标签
          「${topTags[0] || "—"}」上，兼顾情绪浓度与题材流量。</li>
      </ul>
    </div>`;
}

/* ---------- 数据管理 ---------- */
function exportCSV() {
  const records = loadRecords();
  if (!records.length) { alert("暂无数据可导出"); return; }
  let csv = "\uFEFF序号,提交时间,风格参考,最匹配标签,频道-女,频道-男,被选中的题材标签," +
    Array.from({ length: QUIZ_SIZE }, (_, i) => "Q" + (i + 1)).join(",") + "\n";
  records.forEach((r, i) => {
    const ans = (r.picks || []).map((a) => (a >= 0 ? LETTERS[a] : "-")).join(",");
    const ch = r.channel ? `${r.channel["女"].toFixed(1)},${r.channel["男"].toFixed(1)}` : ",";
    csv += `${i + 1},"${formatDate(r.ts)}",${TYPES[r.type].name},${r.topTag || ""},${ch},"${(r.tags || []).join(" / ")}",${ans}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "AI漫剧编剧人格测试_问卷数据.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* 类型之间的亲近度（用于生成更真实的示例数据） */
const TYPE_AFFINITY = {
  F: { F: 1, T: 0.45, M: 0.15, W: 0.25 },
  M: { M: 1, T: 0.4, F: 0.15, W: 0.35 },
  T: { T: 1, F: 0.45, M: 0.4, W: 0.3 },
  W: { W: 1, F: 0.3, T: 0.3, M: 0.15 }
};

function weightedPickIndex(weights, rnd) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function loadDemoData() {
  if (!confirm("将向本地数据中追加 40 份示例问卷（每份从 120 题库中随机抽 30 题），用于演示分析效果。是否继续？")) return;
  const mainWeights = { F: 0.28, M: 0.3, T: 0.24, W: 0.18 };
  const mains = [];
  TYPE_ORDER.forEach((k) => { for (let i = 0; i < mainWeights[k] * 100; i++) mains.push(k); });

  for (let n = 0; n < 40; n++) {
    const main = mains[Math.floor(Math.random() * mains.length)];
    const nvBias = 0.35 + Math.random() * 0.3;   /* 0.35~0.65：个体频道倾向 */
    /* 从 120 题库中随机抽 30 题 */
    const qids = shuffle(QUESTIONS.map((_, i) => i)).slice(0, QUIZ_SIZE);
    const ans = {};
    qids.forEach((qi) => {
      const q = QUESTIONS[qi];
      const w = q.options.map((o) => {
        let v = TYPE_AFFINITY[main][o.t];
        if (o.ch) v *= o.ch === "女" ? nvBias * 2 : (1 - nvBias) * 2;
        return v;
      });
      ans[qi] = weightedPickIndex(w, Math.random);
    });

    const { scores, chScore, tagVotes } = scoreAnswers(ans);
    const rank = rankTags(scores, chScore, tagVotes);
    const tags = qids.map((qi) => QUESTIONS[qi].options[ans[qi]].tag).filter(Boolean);
    saveRecord({
      v: 3,
      ts: Date.now() - Math.floor(Math.random() * 7 * 24 * 3600 * 1000),
      type: pickMainTypeFrom(scores, ans),
      qids: qids,
      picks: qids.map((qi) => ans[qi]),
      tags,
      channel: { 女: chScore["女"], 男: chScore["男"] },
      topTag: rank[0].name
    });
  }
  renderAnalysis();
}

function clearData() {
  if (!confirm("确定清空全部本地问卷数据吗？此操作不可恢复。")) return;
  localStorage.removeItem(STORE_KEY);
  renderAnalysis();
}
