try {
const common = window.TomoCommon;
if (!common) throw new Error("common.js が読み込めませんでした");

const { $, toHalfWidthDigits, randInt, pickOne, beep, celebrateCorrect, createScoreboard } = common;

const score = createScoreboard();

const screens = {
  setup: $("screen-setup"),
  quiz: $("screen-quiz"),
  result: $("screen-result"),
};

const unitModeEl = $("unitMode");
const countEl = $("count");
const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const againBtn = $("againBtn");

const progressEl = $("progress");
const okCountEl = $("okCount");
const ngCountEl = $("ngCount");
const unitLabel = $("unitLabel");
const labelTate = $("labelTate");
const labelYoko = $("labelYoko");
const rectSvg = $("rectSvg");
const rectShape = $("rectShape");
const measureYoko = $("measureYoko");
const measureTate = $("measureTate");

const tateInput = $("tateInput");
const yokoInput = $("yokoInput");
const areaInput = $("areaInput");
const areaUnitLabel = $("areaUnitLabel");
const numpad = $("numpad");
const feedback = $("feedback");
const resultBox = $("resultBox");

const resultSummary = $("resultSummary");
const resultDetail = $("resultDetail");

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function normalizeDigits(el, maxLen) {
  el.addEventListener("input", () => {
    const raw = toHalfWidthDigits(el.value);
    const digits = (raw.match(/[0-9]/g) || []).join("");
    el.value = digits.slice(0, maxLen);
  });
}

normalizeDigits(tateInput, 2);
normalizeDigits(yokoInput, 2);
normalizeDigits(areaInput, 4);

// 身近な物の大きさの一例。実物には差があるため、寸法も表示する。
const COMPARABLES = [
  { label: "消しゴムの小さな面", unit: "cm", tate: 2, yoko: 2 },
  { label: "小さな切手", unit: "cm", tate: 2, yoko: 3 },
  { label: "小さなふせん", unit: "cm", tate: 3, yoko: 3 },
  { label: "消しゴムの広い面", unit: "cm", tate: 3, yoko: 4 },
  { label: "小さなシール", unit: "cm", tate: 4, yoko: 4 },
  { label: "小さな折り紙", unit: "cm", tate: 5, yoko: 5 },
  { label: "小さなメモ用紙", unit: "cm", tate: 6, yoko: 6 },
  { label: "カード", unit: "cm", tate: 5, yoko: 9 },
  { label: "メモ用紙", unit: "cm", tate: 7, yoko: 8 },
  { label: "折り紙", unit: "cm", tate: 8, yoko: 8 },
  { label: "コースター", unit: "cm", tate: 9, yoko: 9 },
  { label: "フロアマット", unit: "m", tate: 1, yoko: 1 },
  { label: "シングルベッド", unit: "m", tate: 1, yoko: 2 },
  { label: "大きなテーブル", unit: "m", tate: 1.5, yoko: 2 },
  { label: "じゅうたん", unit: "m", tate: 2, yoko: 2 },
  { label: "レジャーシート", unit: "m", tate: 2, yoko: 3 },
  { label: "小さなへや", unit: "m", tate: 3, yoko: 3 },
  { label: "子どもべや", unit: "m", tate: 3, yoko: 4 },
  { label: "リビング", unit: "m", tate: 4, yoko: 4 },
  { label: "広いリビング", unit: "m", tate: 4, yoko: 5 },
  { label: "小さな花だん", unit: "m", tate: 5, yoko: 5 },
  { label: "家庭さいえん", unit: "m", tate: 5, yoko: 6 },
  { label: "小さな庭", unit: "m", tate: 6, yoko: 6 },
  { label: "広い庭", unit: "m", tate: 6, yoko: 8 },
  { label: "教室", unit: "m", tate: 7, yoko: 9 },
  { label: "広い教室", unit: "m", tate: 9, yoko: 9 },
];

let lastComparable;
function findComparable(unit, area) {
  const candidates = COMPARABLES.filter((x) => x.unit === unit);
  const distance = (x) => Math.abs(Math.log(area / (x.tate * x.yoko)));
  // 面積の比で比較し、大きさが大幅に違う物を「同じくらい」にしない。
  const close = candidates.filter((x) => distance(x) <= Math.log(1.25));
  const pool = close.length ? close : [candidates.reduce((a, b) => distance(a) < distance(b) ? a : b)];
  const fresh = pool.filter((x) => x !== lastComparable);
  const chosen = pickOne(fresh.length ? fresh : pool);
  lastComparable = chosen;
  return chosen;
}

function openSearch(areaText) {
  // 静的HTMLだけだと、検索結果ページを“取得して解析”するのはCORS/規約/APIキーの問題がある。
  // なので、ブラウザで検索ページを開く方式にする。
  const q = encodeURIComponent(`${areaText} 面積 同じくらい 何`);
  const url = `https://www.google.com/search?q=${q}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatArea(unit, area) {
  if (unit === "m") return `${area} m²`;
  return `${area} cm²`;
}

function createQuestion(unit) {
  if (unit === "m") {
    // 小学生向けに整数m。
    const tate = randInt(1, 9);
    const yoko = randInt(1, 9);
    return { unit, tate, yoko };
  }

  // cm
  // 2けたは出さない（= 1けた × 1けた のみ）
  return { unit: "cm", tate: randInt(2, 9), yoko: randInt(2, 9) };
}

function pickUnit(mode) {
  if (mode === "cm" || mode === "m") return mode;
  return Math.random() < 0.75 ? "cm" : "m";
}

const state = {
  mode: "mix",
  total: 20,
  index: 0,
  ok: 0,
  ng: 0,
  q: null,
  locked: false,
};

let activeInput = tateInput;

[tateInput, yokoInput, areaInput].forEach((el) => {
  el.addEventListener("focus", () => (activeInput = el));
  el.addEventListener("pointerdown", () => (activeInput = el));
});

function dispatchInput(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clearInputs() {
  tateInput.value = "";
  yokoInput.value = "";
  areaInput.value = "";
  dispatchInput(tateInput);
  dispatchInput(yokoInput);
  dispatchInput(areaInput);
  activeInput = tateInput;
  tateInput.focus();
}

function setFeedback(text, ok) {
  feedback.textContent = text;
  feedback.classList.toggle("ok", !!ok);
  feedback.classList.toggle("ng", !ok);
}

function resetFeedback() {
  feedback.textContent = "";
  feedback.classList.remove("ok", "ng");
}

function updateHeader() {
  const totalText = state.total === 0 ? "∞" : String(state.total);
  progressEl.textContent = `${state.index + 1} / ${totalText}`;
  okCountEl.textContent = String(state.ok);
  ngCountEl.textContent = String(state.ng);
}

function renderQuestion(q) {
  unitLabel.textContent = q.unit;
  areaUnitLabel.textContent = q.unit === "m" ? "m²" : "cm²";
  labelTate.textContent = `たて ${q.tate}${q.unit}`;
  labelYoko.textContent = `よこ ${q.yoko}${q.unit}`;

  // 寸法ラベルの余白を残し、同じ倍率でたて・よこを縮尺する。
  const scale = Math.min(220 / q.yoko, 140 / q.tate);
  const width = q.yoko * scale;
  const height = q.tate * scale;
  const x = 70 + (220 - width) / 2;
  const y = 25 + (140 - height) / 2;
  const setAttributes = (el, attrs) => {
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, String(value)));
  };
  setAttributes(rectShape, { x, y, width, height });
  setAttributes(measureYoko, { x1: x, y1: y + height + 10, x2: x + width, y2: y + height + 10 });
  setAttributes(measureTate, { x1: x - 10, y1: y, x2: x - 10, y2: y + height });
  setAttributes(labelYoko, { x: x + width / 2, y: y + height + 32 });
  const labelX = x - 42;
  const labelY = y + height / 2;
  setAttributes(labelTate, { x: labelX, y: labelY, transform: `rotate(-90 ${labelX} ${labelY})` });
  rectSvg.setAttribute("aria-label", `たて${q.tate}${q.unit}、よこ${q.yoko}${q.unit}の四角形`);
}

function showResultBox(q) {
  const area = q.tate * q.yoko;
  const comparable = findComparable(q.unit, area);
  const areaText = formatArea(q.unit, area);

  const html = [
    `<div class="area-result-title">面積：<b>${areaText}</b></div>`,
    `<div class="area-result-sub">だいたい「${comparable.label}」くらい</div>`,
    `<div class="area-result-sub">大きさの例：${comparable.tate}${comparable.unit} × ${comparable.yoko}${comparable.unit} = ${formatArea(comparable.unit, comparable.tate * comparable.yoko)}</div>`,
    `<div class="area-result-actions"><button id="searchBtn" type="button" class="btn btn-ghost">Webでさがす</button><button id="nextBtn" type="button" class="btn btn-primary">つぎへ</button></div>`,
  ].join("");

  resultBox.innerHTML = html;
  resultBox.classList.remove("hidden");

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => openSearch(`${q.tate}${q.unit}×${q.yoko}${q.unit} ${areaText}`));
  }

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) nextBtn.addEventListener("click", () => next());
}

function hideResultBox() {
  resultBox.classList.add("hidden");
  resultBox.textContent = "";
}

function finish() {
  state.locked = true;
  resultSummary.textContent = String(state.ok);
  resultDetail.textContent = `ミス ${state.ng}`;
  showScreen("result");
}

function next() {
  if (state.total !== 0 && state.index + 1 >= state.total) {
    finish();
    return;
  }

  state.index += 1;
  state.q = createQuestion(pickUnit(state.mode));
  state.locked = false;
  hideResultBox();
  resetFeedback();
  updateHeader();
  renderQuestion(state.q);
  clearInputs();
}

function parseIntOrNull(value) {
  const raw = toHalfWidthDigits(value).trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function hasEnoughDigits(el) {
  const q = state.q;
  if (!q) return false;
  const need = expectedDigitsFor(el);
  return String(el.value || "").length >= need;
}

function maybeJudge() {
  if (state.locked) return;
  const q = state.q;
  if (!q) return;

  // 途中入力（例: 63 を入れる途中の「6」）では判定しない。
  if (!hasEnoughDigits(tateInput)) return;
  if (!hasEnoughDigits(yokoInput)) return;
  if (!hasEnoughDigits(areaInput)) return;

  const t = parseIntOrNull(tateInput.value);
  const y = parseIntOrNull(yokoInput.value);
  const a = parseIntOrNull(areaInput.value);

  if (t == null || y == null || a == null) return;

  const okDims = t === q.tate && y === q.yoko;
  const okArea = a === q.tate * q.yoko;

  if (okDims && okArea) {
    state.ok += 1;
    state.locked = true;
    updateHeader();
    setFeedback("せいかい！", true);
    beep(true);
    celebrateCorrect(score.record(true).combo);
    showResultBox(q);
    return;
  }

  state.ng += 1;
  score.record(false);
  updateHeader();
  setFeedback("ちがうよ。もういちど！", false);
  beep(false);
  clearInputs();
}

function expectedDigitsFor(el) {
  const q = state.q;
  if (!q) return 2;
  if (el === tateInput) return String(q.tate).length;
  if (el === yokoInput) return String(q.yoko).length;
  if (el === areaInput) return String(q.tate * q.yoko).length;
  return 2;
}

tateInput.addEventListener("input", () => {
  if (tateInput.value && tateInput.value.length >= expectedDigitsFor(tateInput)) {
    yokoInput.focus();
    activeInput = yokoInput;
  }
  maybeJudge();
});

yokoInput.addEventListener("input", () => {
  if (yokoInput.value && yokoInput.value.length >= expectedDigitsFor(yokoInput)) {
    areaInput.focus();
    activeInput = areaInput;
  }
  maybeJudge();
});

areaInput.addEventListener("input", () => {
  maybeJudge();
});

if (numpad) {
  numpad.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;

    if (state.locked) return;
    const action = btn.getAttribute("data-action");
    const value = btn.getAttribute("data-value");

    if (action === "clear") {
      clearInputs();
      return;
    }
    if (action === "backspace") {
      activeInput.value = String(activeInput.value || "").slice(0, -1);
      dispatchInput(activeInput);
      return;
    }
    if (value && /^(?:[0-9])$/.test(value)) {
      activeInput.value = String(activeInput.value || "") + value;
      dispatchInput(activeInput);
    }
  });
}

function start() {
  score.reset();
  state.mode = String(unitModeEl.value);
  state.total = Number.parseInt(String(countEl.value), 10);
  if (!Number.isFinite(state.total) || state.total < 0) state.total = 20;

  $("finishBtn").classList.toggle("hidden", state.total !== 0);
  state.index = 0;
  state.ok = 0;
  state.ng = 0;
  state.locked = false;
  hideResultBox();
  resetFeedback();

  state.q = createQuestion(pickUnit(state.mode));
  updateHeader();
  renderQuestion(state.q);
  clearInputs();

  showScreen("quiz");
}

$("finishBtn").addEventListener("click", finish);
startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
againBtn.addEventListener("click", start);

showScreen("setup");

} catch (err) {
  try {
    const common = window.TomoCommon;
    if (common && typeof common.showFatalError === "function") {
      common.showFatalError(String((err && err.stack) || (err && err.message) || err));
    }
  } catch (e) {
    // ignore
  }
  throw err;
}
