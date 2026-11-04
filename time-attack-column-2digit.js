try {
const common = window.TomoCommon;
if (!common) throw new Error("common.js が読み込めませんでした");

const {
  $,
  toHalfWidthDigits,
  randInt,
  pickOne,
  formatMs,
  startTicker,
  nowMs,
  beep,
  celebrateCorrect,
  createTransition
} = common;

const QUESTION_COUNT = 20;
const transition = createTransition();

const screens = {
  setup: $("screen-setup"),
  quiz: $("screen-quiz"),
  result: $("screen-result"),
};

const modeSelect = $("mode");
const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const submitBtn = document.getElementById("submitBtn");
const againBtn = $("againBtn");

const progressEl = $("progress");
const timerEl = $("timer");
const mistakesEl = $("mistakes");
const rowTop = $("rowTop");
const rowBottom = $("rowBottom");
const carryLabel = $("carryLabel");
const carryPlusBtn = $("carryPlusBtn");
const carryMinusBtn = $("carryMinusBtn");
const carryValueEl = $("carryValue");
const ansTens = $("ansTens");
const ansOnes = $("ansOnes");
const numpad = $("numpad");
const feedback = $("feedback");

const resultTime = $("resultTime");
const resultDetail = $("resultDetail");

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function pad2(n) {
  return String(n).padStart(2, " ");
}

function create2DigitAdd() {
  // 2けた + 2けた で、答えも2けた(0〜99)にする。
  // 10〜89 と 10〜(99-a) の組み合わせ。
  while (true) {
    const a = randInt(10, 89);
    const bMax = 99 - a;
    if (bMax < 10) continue;
    const b = randInt(10, bMax);
    const ans = a + b;
    if (ans >= 0 && ans <= 99) {
      const carry = (a % 10) + (b % 10) >= 10 ? 1 : 0;
      return { a, b, op: "+", answer: ans, carry };
    }
  }
}

function create2DigitSub() {
  // 2けた - 2けた で、答えも2けた(10〜99)にする。
  while (true) {
    const a = randInt(20, 99);
    const bMax = a - 10;
    if (bMax < 10) continue;
    const b = randInt(10, bMax);
    const ans = a - b;
    if (ans >= 10 && ans <= 99) {
      const borrow = (a % 10) < (b % 10) ? -1 : 0;
      return { a, b, op: "-", answer: ans, carry: borrow };
    }
  }
}

function createSet(mode) {
  const ops = mode === "mix" ? ["add", "sub"] : [mode];
  const questions = [];
  for (let i = 0; i < QUESTION_COUNT; i += 1) {
    const picked = pickOne(ops);
    questions.push(picked === "add" ? create2DigitAdd() : create2DigitSub());
  }
  return questions;
}

const state = {
  questions: [],
  index: 0,
  mistakes: 0,
  startMs: 0,
  stopTick: null,
  active: false,
  locked: false,
};

let carryAnswer = 0; // -1 / 0 / +1

function setCarryAnswer(next) {
  carryAnswer = next;
  if (carryValueEl) carryValueEl.textContent = String(carryAnswer);
  if (carryPlusBtn) carryPlusBtn.classList.toggle("is-active", carryAnswer === 1);
  if (carryMinusBtn) carryMinusBtn.classList.toggle("is-active", carryAnswer === -1);
}

function trySetCarry(next) {
  const q = state.questions[state.index];
  if (!q) return;
  if (q.op === "+" && next === -1) {
    beep(false);
    return;
  }
  if (q.op === "-" && next === 1) {
    beep(false);
    return;
  }
  setCarryAnswer(next);
}

function resetFeedback() {
  feedback.textContent = "";
  feedback.classList.remove("ok", "ng");
}

function updateHeader() {
  progressEl.textContent = `${state.index + 1} / ${QUESTION_COUNT}`;
  mistakesEl.textContent = String(state.mistakes);
}

function renderProblem(q) {
  rowTop.textContent = ` ${pad2(q.a)}`;
  const sign = q.op === "+" ? "+" : "−";
  rowBottom.textContent = `${sign}${pad2(q.b)}`;
  carryLabel.textContent = q.op === "+" ? "くり上がり（+1）" : "くり下がり（-1）";
}

function focusAnswer() {
  ansTens.value = "";
  ansOnes.value = "";
  setCarryAnswer(0);
  ansOnes.focus();
}

function showQuestion() {
  const q = state.questions[state.index];
  renderProblem(q);
  resetFeedback();
  updateHeader();
  focusAnswer();
  state.locked = false;
}

function stopTimer() {
  if (state.stopTick) state.stopTick();
  state.stopTick = null;
}

function startTimer() {
  stopTimer();
  state.startMs = nowMs();
  state.stopTick = startTicker(() => {
    timerEl.textContent = formatMs(nowMs() - state.startMs);
  });
}

function finish() {
  state.active = false;
  stopTimer();
  const elapsed = nowMs() - state.startMs;
  resultTime.textContent = formatMs(elapsed);
  resultDetail.textContent = `ミス ${state.mistakes}`;
  showScreen("result");
}

function digitFromInput(el) {
  const raw = toHalfWidthDigits(el.value).trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 9) return null;
  return n;
}

function carryFromInput() {
  if (carryAnswer !== -1 && carryAnswer !== 0 && carryAnswer !== 1) return null;
  return carryAnswer;
}

function parseAnswer() {
  const carry = carryFromInput();
  const tens = digitFromInput(ansTens);
  const ones = digitFromInput(ansOnes);

  if (carry === null) {
    return { ok: false, message: "くりを えらんでね" };
  }

  if (tens === null && ones === null) {
    return { ok: false, message: "こたえを いれてね" };
  }
  if (ones === null) {
    return { ok: false, message: "1の位を いれてね" };
  }
  const value = (tens ?? 0) * 10 + ones;
  return { ok: true, value, carry };
}

function submit() {
  if (!state.active || state.locked) return;

  const parsed = parseAnswer();
  if (!parsed.ok) {
    feedback.textContent = parsed.message;
    feedback.classList.add("ng");
    return;
  }

  const q = state.questions[state.index];
  const ok = parsed.value === q.answer && parsed.carry === q.carry;

  if (ok) {
    state.locked = true;
    feedback.textContent = "せいかい！";
    feedback.classList.add("ok");
    beep(true);
    celebrateCorrect();
    transition.schedule(() => {
      if (state.index + 1 >= QUESTION_COUNT) {
        finish();
        return;
      }
      state.index += 1;
      showQuestion();
    }, 260);
    return;
  }

  state.mistakes += 1;
  if (parsed.value === q.answer && parsed.carry !== q.carry) {
    feedback.textContent = "くりが ちがうよ！";
  } else {
    feedback.textContent = "ちがうよ。もういちど！";
  }
  feedback.classList.add("ng");
  beep(false);
  updateHeader();
  ansOnes.select();
  state.locked = false;
}

function maybeAutoSubmit() {
  if (!state.active || state.locked) return;
  if (!ansOnes.value) return;
  if (!ansTens.value) return;
  submit();
}

function normalizeDigitInput(el) {
  el.addEventListener("input", () => {
    const raw = toHalfWidthDigits(el.value);
    const m = raw.match(/[0-9]/);
    el.value = m ? m[0] : "";
  });
}

function start() {
  transition.cancel();
  const mode = String(modeSelect.value);

  state.questions = createSet(mode);
  state.active = true;
  state.index = 0;
  state.mistakes = 0;
  timerEl.textContent = "0:00.00";

  showScreen("quiz");
  showQuestion();
  startTimer();
}

// ---- On-screen numpad wiring (for mobile/tablet) ----
const answerInputs = [ansOnes, ansTens];
let activeInput = ansOnes;

function setActiveInput(el) {
  if (!el) return;
  activeInput = el;
}

answerInputs.forEach((el) => {
  el.addEventListener("focus", () => setActiveInput(el));
  el.addEventListener("pointerdown", () => setActiveInput(el));
});

function dispatchInput(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function clearAllAnswers() {
  ansTens.value = "";
  ansOnes.value = "";
  dispatchInput(ansTens);
  dispatchInput(ansOnes);
  setCarryAnswer(0);
  ansOnes.focus();
}

function clearActive() {
  if (!activeInput) return;
  activeInput.value = "";
  dispatchInput(activeInput);
}

function backspaceActive() {
  if (!activeInput) return;

  if (activeInput.value) {
    clearActive();
    return;
  }

  if (activeInput === ansTens) {
    ansOnes.focus();
    activeInput = ansOnes;
    clearActive();
  }
}

function setDigitToActive(digit) {
  if (!activeInput) return;
  if (!state.active || state.locked) return;
  const input = activeInput;
  input.value = String(digit);
  dispatchInput(input);
}

if (numpad) {
  numpad.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const value = btn.getAttribute("data-value");

    if (action === "clear") {
      clearAllAnswers();
      return;
    }
    if (action === "backspace") {
      backspaceActive();
      return;
    }

    if (value && /^(?:[0-9])$/.test(value)) {
      setDigitToActive(Number.parseInt(value, 10));
    }
  });
}

normalizeDigitInput(ansTens);
normalizeDigitInput(ansOnes);

// 1の位 → 10の位 の順で入力しやすくする
ansOnes.addEventListener("input", () => {
  if (ansOnes.value) ansTens.focus();
  maybeAutoSubmit();
});

ansTens.addEventListener("input", () => {
  maybeAutoSubmit();
});

ansTens.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
  if (e.key === "ArrowRight") ansOnes.focus();
  if (e.key === "ArrowLeft") ansOnes.focus();
});

ansOnes.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
  if (e.key === "ArrowLeft") ansTens.focus();
  if (e.key === "ArrowRight") ansTens.focus();
});

if (carryPlusBtn) {
  carryPlusBtn.addEventListener("click", () => {
    const next = carryAnswer === 1 ? 0 : 1;
    trySetCarry(next);
    maybeAutoSubmit();
  });
}

if (carryMinusBtn) {
  carryMinusBtn.addEventListener("click", () => {
    const next = carryAnswer === -1 ? 0 : -1;
    trySetCarry(next);
    maybeAutoSubmit();
  });
}

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
againBtn.addEventListener("click", start);
if (submitBtn) submitBtn.addEventListener("click", submit);

window.addEventListener("pagehide", () => { transition.cancel(); stopTimer(); state.active = false; });
window.addEventListener("pageshow", (event) => { if (event.persisted) showScreen("setup"); });
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
