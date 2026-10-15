/* ============================================================
 * AI漫剧编剧人格测试 - 测试主逻辑
 * 30题（10情景 + 20题材，标签每题出现2次，选项随机排序）
 * ============================================================ */

const STORE_KEY = "aiDramaRecords";

/* ---------- 基础工具 ---------- */
function loadRecords() {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    /* 仅保留新版格式（v=3，120 题库中抽 30 道） */
    return all.filter((r) => r.v === 3 && Array.isArray(r.qids) && Array.isArray(r.picks) && r.qids.length === r.picks.length);
  } catch (e) {
    return [];
  }
}

function saveRecord(record) {
  let all = [];
  try { all = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { all = []; }
  all.push(record);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 视图切换 ---------- */
const views = ["home", "quiz", "result", "analysis"];

function showView(name) {
  views.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("active", v === name);
  });
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "analysis" && typeof renderAnalysis === "function") renderAnalysis();
}

/* ---------- 测试状态 ---------- */
let order = [];         /* 本轮呈现顺序（题库下标，从 120 题中随机抽 30） */
let displayOrder = {};  /* { 题库下标: [选项原始下标的呈现顺序] } */
let answers = {};       /* { 题库下标: 选项原始下标 } */
let currentQ = 0;

/* 从 120 题库抽取 size 道题：
 *   1) 题干（scene）互不相同
 *   2) 选项文字在一轮 30 题内互不重复
 * 逐级放宽约束，保证一定能取满 size 道 */
function sampleQuestions(size) {
  const idx = shuffle(QUESTIONS.map((_, i) => i));
  const usedScene = new Set();
  const usedOpt = new Set();
  const picked = [];
  const taken = (qi) => picked.indexOf(qi) >= 0;

  /* 第 1 轮：题干唯一 + 选项文字唯一 */
  for (const qi of idx) {
    if (picked.length >= size) break;
    const q = QUESTIONS[qi];
    if (usedScene.has(q.scene)) continue;
    const texts = q.options.map((o) => o.text);
    if (texts.some((t) => usedOpt.has(t))) continue;
    usedScene.add(q.scene);
    texts.forEach((t) => usedOpt.add(t));
    picked.push(qi);
  }
  /* 第 2 轮：只保证题干唯一 */
  if (picked.length < size) {
    for (const qi of idx) {
      if (picked.length >= size) break;
      if (taken(qi) || usedScene.has(QUESTIONS[qi].scene)) continue;
      usedScene.add(QUESTIONS[qi].scene);
      picked.push(qi);
    }
  }
  /* 第 3 轮兜底：直接补足 */
  if (picked.length < size) {
    for (const qi of idx) {
      if (picked.length >= size) break;
      if (!taken(qi)) picked.push(qi);
    }
  }
  return shuffle(picked);
}

function startTest() {
  /* 从 POOL_SIZE 题中随机抽 QUIZ_SIZE 道，题干与选项文字均不重复 */
  const sampled = sampleQuestions(QUIZ_SIZE);
  /* 题目呈现顺序（sampleQuestions 内部已打乱） */
  order = sampled;
  /* 给被抽中的题生成选项呈现顺序（没被抽中的题不进入 displayOrder） */
  displayOrder = {};
  sampled.forEach((qi) => {
    displayOrder[qi] = shuffle(QUESTIONS[qi].options.map((_, i) => i));
  });
  answers = {};
  currentQ = 0;
  showView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const box = document.getElementById("quiz-box");
  const qi = order[currentQ];
  const q = QUESTIONS[qi];
  const letters = ["A", "B", "C", "D"];
  const picked = answers[qi];
  const perm = displayOrder[qi];   /* 本题选项的呈现顺序（原始下标） */

  box.innerHTML = `
    <div class="q-tag">${q.type === "scene" ? "🎬 情景题 · 看你的编剧直觉" : "📚 题材题 · 看你偏爱的赛道"}</div>
    <h2 class="q-title">${q.scene}</h2>
    <div class="options">
      ${perm
        .map(
          (oi, di) => {
            const opt = q.options[oi];
            return `
        <button class="option ${picked === oi ? "selected" : ""}" data-i="${oi}">
          <span class="opt-letter" style="--c:${TYPES[opt.t].color}">${letters[di]}</span>
          <span class="opt-text">${opt.text}</span>
        </button>`;
          }
        )
        .join("")}
    </div>
    <div class="quiz-nav">
      <button class="btn btn-ghost" onclick="prevQuestion()" ${currentQ === 0 ? "disabled" : ""}>← 上一题</button>
      ${
        picked === undefined
          ? `<span class="quiz-hint">选择后自动进入下一题</span>`
          : currentQ === order.length - 1
            ? `<button class="btn btn-primary" onclick="finishTest()">提交答卷 →</button>`
            : `<button class="btn btn-primary" onclick="nextQuestion()">下一题 →</button>`
      }
    </div>
  `;

  box.querySelectorAll(".option").forEach((btn) => {
    btn.addEventListener("click", () => selectOption(Number(btn.dataset.i)));
  });

  const done = Object.keys(answers).length;
  document.getElementById("quiz-progress").style.width = (done / order.length) * 100 + "%";
  document.getElementById("quiz-progress-text").textContent =
    `第 ${currentQ + 1} / ${order.length} 题　·　从 ${POOL_SIZE} 题题库中随机抽得　·　已作答 ${done} 题`;
}

function selectOption(i) {
  const qi = order[currentQ];
  answers[qi] = i;
  renderQuestion();
  if (currentQ < order.length - 1) {
    setTimeout(() => {
      if (answers[qi] === i && currentQ < order.length - 1) {
        currentQ += 1;
        renderQuestion();
      }
    }, 380);
  }
}

function nextQuestion() {
  if (answers[order[currentQ]] === undefined) { alert("请先凭第一直觉选择一个选项哦～"); return; }
  if (currentQ < order.length - 1) { currentQ += 1; renderQuestion(); }
  else { finishTest(); }
}

function prevQuestion() {
  if (currentQ > 0) { currentQ -= 1; renderQuestion(); }
}

/* ============================================================
 * 计分：人格维度 + 频道维度 + 标签投票
 * 归一化规则：某题的某个类型有 n 个选项时，选中该类型得 1/n 分，
 * 使随机作答对每个类型的期望收益相同，避免选项分布造成的偏差。
 * ============================================================ */
function scoreAnswers(ans) {
  const scores = { F: 0, M: 0, T: 0, W: 0 };
  const chScore = { 女: 0, 男: 0 };
  const tagVotes = {};

  QUESTIONS.forEach((q, qi) => {
    const ai = ans[qi];
    if (ai === undefined) return;
    const dist = { F: 0, M: 0, T: 0, W: 0 };
    const cdist = { 女: 0, 男: 0 };
    q.options.forEach((o) => { dist[o.t]++; if (o.ch) cdist[o.ch]++; });

    const opt = q.options[ai];
    scores[opt.t] += 1 / dist[opt.t];
    if (opt.ch) chScore[opt.ch] += 1 / cdist[opt.ch];
    if (opt.tag) tagVotes[opt.tag] = (tagVotes[opt.tag] || 0) + 1;
  });

  return { scores, chScore, tagVotes };
}

/* 主类型：得分最高者；同分时取更靠后的作答（更接近编制直觉） */
function pickMainTypeFrom(scores, ans) {
  let best = "F";
  for (let i = order.length - 1; i >= 0; i--) {
    const ai = ans[i];
    if (ai === undefined) continue;
    const t = QUESTIONS[i].options[ai].t;
    if (scores[t] > scores[best]) best = t;
  }
  return best;
}

/* ============================================================
 * 标签匹配：类型契合度(余弦) + 直接选择命中率 + 频道契合
 * ============================================================ */
function rankTags(scores, chScore, tagVotes) {
  const sum = TYPE_ORDER.reduce((a, k) => a + scores[k], 0) || 1;
  const u = TYPE_ORDER.map((k) => scores[k] / sum);
  const nu = Math.sqrt(u.reduce((a, x) => a + x * x, 0)) || 1;
  const totalCh = chScore["女"] + chScore["男"];
  const nvRatio = totalCh > 0 ? chScore["女"] / totalCh : 0.5;

  return TAGS.map((tg) => {
    const v = { F: 0, M: 0, T: 0, W: 0 };
    v[tg.main] += 0.65;
    v[tg.sub] += 0.35;
    const vn = TYPE_ORDER.map((k) => v[k]);
    const nv = Math.sqrt(vn.reduce((a, x) => a + x * x, 0)) || 1;
    const cos = u.reduce((a, x, i) => a + x * vn[i], 0) / (nu * nv);

    const entry = TAG_ENTRY_COUNT[tg.name] || 1;
    const voteScore = Math.min((tagVotes[tg.name] || 0) / entry, 1);
    const chMatch = tg.ch === "女" ? nvRatio : 1 - nvRatio;
    const fit = 0.45 * cos + 0.35 * voteScore + 0.2 * chMatch;

    return { ...tg, fit, cos, voteScore, chMatch, votes: tagVotes[tg.name] || 0 };
  }).sort((a, b) => b.fit - a.fit);
}

/* ---------- 提交 ---------- */
function finishTest() {
  const unanswered = order.filter((qi) => answers[qi] === undefined).length;
  if (unanswered > 0) {
    if (!confirm(`还有 ${unanswered} 题未作答，未作答题目不会计入结果。确定提交吗？`)) return;
  }
  const { scores, chScore, tagVotes } = scoreAnswers(answers);
  const main = pickMainTypeFrom(scores, answers);
  const rank = rankTags(scores, chScore, tagVotes);
  renderResult(scores, main, chScore, rank);
  showView("result");
}

function renderResult(scores, main, chScore, rank) {
  const type = TYPES[main];
  const sum = TYPE_ORDER.reduce((a, k) => a + scores[k], 0) || 1;
  const totalCh = chScore["女"] + chScore["男"];
  const nvPct = totalCh > 0 ? Math.round((chScore["女"] / totalCh) * 100) : 50;
  const top = rank[0];
  const secondary = rank.slice(1, 3);
  const sortedPct = TYPE_ORDER
    .map((k) => ({ k, pct: (scores[k] / sum) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const topStyle = TYPES[sortedPct[0].k];

  document.getElementById("result-box").innerHTML = `
    <div class="result-card" style="--c:${TYPES[top.main].color}">
      <div class="result-emoji">${topStyle.emoji}</div>
      <div class="result-label">最像你的 AI 漫剧创作画像</div>
      <h2 class="result-name">${top.name}</h2>
      <div class="result-title">「${top.desc}」</div>
      <p class="result-desc">
        你的创作底色最接近 <b style="color:${topStyle.color}">${topStyle.emoji}${topStyle.name}</b>，但又不局限于一种风格。
      </p>
      <p class="result-secondary">
        与你气质契合的副画像：<b>${secondary[0].name}</b> + <b>${secondary[1].name}</b>
      </p>
      <div class="result-tags">${type.traits.map((t) => `<span>${t}</span>`).join("")}</div>

      <div class="result-mix">
        <h3>创作风格成分 <small>（参考 · 你的画像可能横跨多派）</small></h3>
        ${TYPE_ORDER.map((k) => {
          const t = TYPES[k];
          const pct = Math.round((scores[k] / sum) * 100);
          return `<div class="mix-row">
            <span class="mix-name">${t.emoji} ${t.name}</span>
            <div class="mix-bar"><i style="width:${pct}%;background:${t.color}"></i></div>
            <span class="mix-pct">${pct}%</span>
          </div>`;
        }).join("")}
      </div>

      <div class="result-mix">
        <h3>频道倾向</h3>
        <div class="mix-row">
          <span class="mix-name">女频题材</span>
          <div class="mix-bar"><i style="width:${nvPct}%;background:#ff7fb0"></i></div>
          <span class="mix-pct">${nvPct}%</span>
        </div>
        <div class="mix-row">
          <span class="mix-name">男频题材</span>
          <div class="mix-bar"><i style="width:${100 - nvPct}%;background:#5bb8ff"></i></div>
          <span class="mix-pct">${100 - nvPct}%</span>
        </div>
      </div>
    </div>

    <div class="result-card tag-result" style="--c:${TYPES[top.main].color}">
      <div class="tag-result-head">
        <div class="result-label">与你最匹配的 AI 漫剧题材标签</div>
        <h2 class="tag-top-name">${top.name}</h2>
        <p class="tag-top-desc">${top.desc}</p>
      </div>

      <h3 class="tag-list-title">TOP 5 题材标签</h3>
      <div class="tag-rank-list">
        ${rank.slice(0, 5).map((t, i) => `
          <div class="tag-rank-item ${i === 0 ? "first" : ""}">
            <span class="tag-rank-no">${i + 1}</span>
            <div class="tag-rank-body">
              <div class="tag-rank-line">
                <b>${t.name}</b>
                <span class="tag-rank-fit">契合度 ${Math.round(t.fit * 100)}%</span>
              </div>
              <div class="tag-rank-bar"><i style="width:${Math.round(t.fit * 100)}%;background:${TYPES[t.main].color}"></i></div>
              <div class="tag-rank-desc">${t.desc}　·　命中 ${t.votes} 次</div>
            </div>
          </div>`).join("")}
      </div>

      <div class="result-actions">
        <button class="btn btn-primary" onclick="saveAndGo()">保存结果 · 查看全员数据分析</button>
        <button class="btn btn-ghost" onclick="copyResult()">复制结果文案</button>
        <button class="btn btn-ghost" onclick="window.scrollTo({top:0,behavior:'smooth'})">回到顶部</button>
        <button class="btn btn-ghost" onclick="startTest()">重新测一次</button>
      </div>
    </div>
  `;

  renderResult._last = { scores, main, chScore, rank };
}

function saveAndGo() {
  const { main, chScore, rank } = renderResult._last;
  /* 本轮抽中的题库下标 + 用户所选选项下标（按呈现顺序） */
  const qids = order.slice();
  const picks = order.map((qi) => (answers[qi] === undefined ? -1 : answers[qi]));
  saveRecord({
    v: 3,
    ts: Date.now(),
    type: main,
    qids: qids,
    picks: picks,
    tags: qids
      .map((qi, i) => {
        const q = QUESTIONS[qi];
        const a = picks[i];
        return a >= 0 && q.options[a] && q.options[a].tag ? q.options[a].tag : null;
      })
      .filter(Boolean),
    channel: { 女: chScore["女"], 男: chScore["男"] },
    topTag: rank[0].name
  });
  showView("analysis");
}

function copyResult() {
  const { main, chScore, rank } = renderResult._last;
  const type = TYPES[main];
  const totalCh = chScore["女"] + chScore["男"];
  const nvPct = totalCh > 0 ? Math.round((chScore["女"] / totalCh) * 100) : 50;
  const chText = nvPct >= 50 ? `女频 ${nvPct}%` : `男频 ${100 - nvPct}%`;
  const text =
    `我在「AI漫剧创作人格测试」中测出：\n` +
    `最像我的创作画像：${rank[0].name}\n` +
    `副画像：${rank.slice(1, 3).map((t) => t.name).join(" + ")}\n` +
    `底色参考：${type.emoji}${type.name}（${chText}）\n` +
    `快来测测你最像哪个AI漫剧题材标签！`;
  const done = () => alert("结果已复制，快去分享吧！");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) {}
  document.body.removeChild(ta);
}
