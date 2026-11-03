try {
const common = window.TomoCommon;
if (!common) throw new Error("common.v2.js が読み込めませんでした");

const { $, toHalfWidthDigits, randInt, pickOne, beep } = common;

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

// ---- comparable sizes (rough guide) ----
// area_cm2 is the *center* area, range is used for matching.
const COMPARABLES = [
  { label: "スマホ（だいたい）", unit: "cm", min: 60, max: 180 },
  { label: "はがき（だいたい）", unit: "cm", min: 100, max: 230 },
  { label: "A4の紙（だいたい）", unit: "cm", min: 500, max: 800 },
  { label: "ノート（B5くらい）", unit: "cm", min: 350, max: 650 },
  { label: "マウスパッド（だいたい）", unit: "cm", min: 350, max: 900 },
  { label: "まな板（だいたい）", unit: "cm", min: 700, max: 1400 },
  { label: "学習机の天板（だいたい）", unit: "cm", min: 1800, max: 3500 },
  { label: "バスタオル（だいたい）", unit: "cm", min: 5000, max: 10000 },
  { label: "ドア（だいたい）", unit: "cm", min: 12000, max: 22000 },
  { label: "シングルベッド（だいたい）", unit: "cm", min: 15000, max: 30000 },
  // m^2 scale examples (stored in cm^2)
  { label: "たたみ1じょう（だいたい）", unit: "m", min: 12000, max: 22000 },
];

function findComparable(areaCm2) {
  const hits = COMPARABLES.filter((x) => areaCm2 >= x.min && areaCm2 <= x.max);
  if (hits.length) return pickOne(hits).label;

  // fallback: nearest by distance to range center
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const x of COMPARABLES) {
    const center = (x.min + x.max) / 2;
    const score = Math.abs(areaCm2 - center);
    if (score < bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best ? `${best.label}（ちょっと近い）` : "";
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

function toCm2(unit, tate, yoko) {
  const a = tate * yoko;
  if (unit === "m") return a * 10000;
  return a;
}

function createQuestion(unit) {
  if (unit === "m") {
    // 小学生向けに整数m。
    const tate = randInt(1, 9);
    const yoko = randInt(1, 9);
    return { unit, tate, yoko };
  }

  // cm
  // 「2けた × 2けた」は出さない（= どちらか片方は1けたにする）
  // 例: 8cm × 45cm など
  const one = randInt(2, 9);
  const two = randInt(10, 99);

  // ときどき 1けた × 1けた も混ぜる
  if (Math.random() < 0.25) {
    return { unit: "cm", tate: randInt(2, 9), yoko: randInt(2, 9) };
  }

  if (Math.random() < 0.5) {
    return { unit: "cm", tate: one, yoko: two };
  }
  return { unit: "cm", tate: two, yoko: one };
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

  // それっぽく長さで比率を変える（見た目用）
  // 70..250 の範囲に収める
  const baseW = 200;
  const baseH = 140;
  const max = Math.max(q.tate, q.yoko);
  const w = Math.round(baseW * (q.yoko / max));
  const h = Math.round(baseH * (q.tate / max));
  const x = Math.round(160 - w / 2);
  const y = Math.round(110 - h / 2);

  const svg = document.getElementById("rectSvg");
  const rect = svg && svg.querySelector("rect");
  if (rect) {
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(w));
    rect.setAttribute("height", String(h));
  }
}

function showResultBox(q) {
  const area = q.tate * q.yoko;
  const areaCm2 = toCm2(q.unit, q.tate, q.yoko);
  const comparable = findComparable(areaCm2);
  const areaText = formatArea(q.unit, area);

  const html = [
    `<div class="area-result-title">面積：<b>${areaText}</b></div>`,
    comparable ? `<div class="area-result-sub">だいたい「${comparable}」くらい</div>` : "",
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

function next() {
  if (state.total !== 0 && state.index + 1 >= state.total) {
    resultSummary.textContent = String(state.ok);
    resultDetail.textContent = `ミス ${state.ng}`;
    showScreen("result");
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
    showResultBox(q);
    return;
  }

  state.ng += 1;
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
      if (activeInput === tateInput) {
        const q = state.q;
        const need = q ? String(q.tate).length : 2;
        if (tateInput.value.length < need) return;

        // たてが入ったら右へ
        yokoInput.focus();
        activeInput = yokoInput;
      }

      if (activeInput === yokoInput) {
        const q = state.q;
        const need = q ? String(q.yoko).length : 2;
        if (yokoInput.value.length < need) return;

        areaInput.focus();
        activeInput = areaInput;
      }

      if (activeInput === areaInput) {
        const q = state.q;
        const need = q ? String(q.tate * q.yoko).length : 4;
        if (areaInput.value.length < need) return;

        maybeJudge();
      }
    }
  });
}

function start() {
  state.mode = String(unitModeEl.value);
  state.total = Number.parseInt(String(countEl.value), 10);
  if (!Number.isFinite(state.total) || state.total < 0) state.total = 20;

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
