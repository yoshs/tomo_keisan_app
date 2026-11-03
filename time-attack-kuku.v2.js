try {
const common = window.TomoCommon;
if (!common) throw new Error("common.js が読み込めませんでした");

const {
  $,
  toHalfWidthDigits,
  shuffleInPlace,
  formatMs,
  startTicker,
  nowMs,
  beep,
  mountNumpad
} = common;

const QUESTION_COUNT = 45;

const screens = {
  setup: $("screen-setup"),
  quiz: $("screen-quiz"),
  result: $("screen-result"),
};

const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const submitBtn = $("submitBtn");
const againBtn = $("againBtn");

const progressEl = $("progress");
const timerEl = $("timer");
const mistakesEl = $("mistakes");
const problemText = $("problemText");
const answerInput = $("answerInput");
const feedback = $("feedback");
const numpad = $("numpad");

const resultTime = $("resultTime");
const resultDetail = $("resultDetail");

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function createKukuSet() {
  const all = [];
  for (let a = 1; a <= 9; a += 1) {
    for (let b = 1; b <= 9; b += 1) {
      all.push({ a, b, answer: a * b, text: `${a} × ${b} = ?` });
    }
  }
  shuffleInPlace(all);
  return all.slice(0, QUESTION_COUNT);
}

const state = {
  questions: [],
  index: 0,
  mistakes: 0,
  startMs: 0,
  stopTick: null,
  busy: false,
};

function resetFeedback() {
  feedback.textContent = "";
  feedback.classList.remove("ok", "ng");
}

function updateHeader() {
  progressEl.textContent = `${state.index + 1} / ${QUESTION_COUNT}`;
  mistakesEl.textContent = String(state.mistakes);
}

function showQuestion() {
  const q = state.questions[state.index];
  problemText.textContent = q.text;
  answerInput.value = "";
  state.busy = false;
  resetFeedback();
  updateHeader();
  answerInput.focus();
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
  stopTimer();
  const elapsed = nowMs() - state.startMs;
  resultTime.textContent = formatMs(elapsed);
  resultDetail.textContent = `ミス ${state.mistakes}`;
  showScreen("result");
}

function parseAnswer() {
  const raw = toHalfWidthDigits(answerInput.value).trim();
  if (!raw) return { ok: false, message: "こたえを いれてね" };
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return { ok: false, message: "すうじで いれてね" };
  return { ok: true, value: n };
}

function sanitizeDigits(value) {
  return toHalfWidthDigits(value).replace(/[^0-9]/g, "");
}

function handleCorrect() {
  if (state.busy) return;
  state.busy = true;
  feedback.textContent = "せいかい！";
  feedback.classList.add("ok");
  beep(true);
  window.setTimeout(() => {
    if (state.index + 1 >= QUESTION_COUNT) {
      finish();
      return;
    }
    state.index += 1;
    showQuestion();
  }, 220);
}

function handleWrong() {
  if (state.busy) return;
  state.mistakes += 1;
  feedback.textContent = "ちがうよ！";
  feedback.classList.add("ng");
  beep(false);
  updateHeader();
  answerInput.value = "";
  answerInput.focus();
}

function autoJudge() {
  if (state.busy) return;
  const q = state.questions[state.index];
  const target = String(q.answer);
  const raw = sanitizeDigits(answerInput.value);

  if (raw !== answerInput.value) {
    answerInput.value = raw;
  }

  if (!raw) {
    resetFeedback();
    return;
  }

  if (raw.length > target.length) {
    handleWrong();
    return;
  }

  if (target.startsWith(raw)) {
    if (raw === target) handleCorrect();
    return;
  }

  handleWrong();
}

function submit() {
  const parsed = parseAnswer();
  if (!parsed.ok) {
    feedback.textContent = parsed.message;
    feedback.classList.add("ng");
    answerInput.focus();
    return;
  }

  const q = state.questions[state.index];
  if (parsed.value === q.answer) {
    handleCorrect();
  } else {
    handleWrong();
  }
}

mountNumpad({ inputEl: answerInput, containerEl: numpad });

// ※筆算ページ以外は画面テンキーを出す（タッチ端末のみ）

function start() {
  state.questions = createKukuSet();
  state.index = 0;
  state.mistakes = 0;
  timerEl.textContent = "0:00.00";

  showScreen("quiz");
  showQuestion();
  startTimer();
}

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
againBtn.addEventListener("click", start);
submitBtn.addEventListener("click", submit);
answerInput.addEventListener("input", autoJudge);
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
});

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
