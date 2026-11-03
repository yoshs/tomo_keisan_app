try {
const common = window.TomoCommon;
if (!common) throw new Error("common.js が読み込めませんでした");

const {
  $,
  clampInt,
  toHalfWidthDigits,
  randInt,
  pickOne,
  formatMs,
  difficultyToMax,
  startTicker,
  nowMs,
  beep,
  mountNumpad
} = common;

// デフォルトの問題数（設定で変えられる）
const DEFAULT_QUESTION_COUNT = 45;

const screens = {
  setup: $("screen-setup"),
  quiz: $("screen-quiz"),
  result: $("screen-result"),
};

const difficultySelect = $("difficulty");
const countSelect = $("count");
const zeroSelect = $("zero");
const modeSelect = $("mode");
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

function zeroRateFromSetting(setting) {
  if (setting === "many") return 0.25;
  if (setting === "some") return 0.1;
  return 0;
}

function createAddProblem(maxSum, zeroRate) {
  // 偏りを減らしつつ、0の問題も少し混ぜる。
  // - zeroRateの確率で「0を使う」
  // - 0+0 は避ける（単調すぎるため）
  if (zeroRate > 0 && Math.random() < zeroRate) {
    const other = randInt(1, maxSum);
    if (Math.random() < 0.5) {
      return { a: 0, b: other, text: `0 + ${other} = ?`, answer: other };
    }
    return { a: other, b: 0, text: `${other} + 0 = ?`, answer: other };
  }

  // a,bを独立に引き、a+b<=maxSum で採用（a,b>0）
  while (true) {
    const a = randInt(1, maxSum);
    const b = randInt(1, maxSum);
    if (a + b > maxSum) continue;
    return { a, b, text: `${a} + ${b} = ?`, answer: a + b };
  }
}

function createSubProblem(maxA, zeroRate) {
  // 偏りを減らしつつ、0の問題も少し混ぜる。
  // - zeroRateの確率で「0を使う」（a-0 or a-a）
  // - 基本は b<a にして答え0を避ける
  if (maxA <= 0) return { a: 0, b: 0, text: "0 − 0 = ?", answer: 0 };
  if (zeroRate > 0 && Math.random() < zeroRate) {
    const a = randInt(1, maxA);
    if (Math.random() < 0.5) {
      return { a, b: 0, text: `${a} − 0 = ?`, answer: a };
    }
    return { a, b: a, text: `${a} − ${a} = ?`, answer: 0 };
  }

  while (true) {
    const a = randInt(1, maxA);
    const b = randInt(1, maxA);
    if (b >= a) continue;
    return { a, b, text: `${a} − ${b} = ?`, answer: a - b };
  }
}

function createQuestionSet(difficulty, mode, count, zeroRate) {
  const max = difficultyToMax(difficulty);

  // まぜるはなるべく半々にする
  let ops = [];
  if (mode === "mix") {
    const addCount = Math.floor(count / 2);
    const subCount = count - addCount;
    ops = Array(addCount).fill("add").concat(Array(subCount).fill("sub"));
    // common.js のシャッフルを利用して偏りを減らす
    if (typeof common.shuffleInPlace === "function") {
      common.shuffleInPlace(ops);
    }
  } else {
    ops = Array(count).fill(mode);
  }

  const questions = [];
  const used = new Set();

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];

    // 同じような問題の重複（例: 7+3 と 3+7）を避ける
    let q = null;
    for (let tries = 0; tries < 500; tries += 1) {
      const candidate =
        op === "add" ? createAddProblem(max, zeroRate) : createSubProblem(max, zeroRate);
      const key =
        op === "add"
          ? `add:${Math.min(candidate.a, candidate.b)}+${Math.max(candidate.a, candidate.b)}`
          : `sub:${candidate.a}-${candidate.b}`;
      if (used.has(key)) continue;
      used.add(key);
      q = { text: candidate.text, answer: candidate.answer };
      break;
    }

    // 念のため（可能性は低いが）ユニーク生成に失敗した場合はそのまま追加
    if (!q) {
      const fallback =
        op === "add" ? createAddProblem(max, zeroRate) : createSubProblem(max, zeroRate);
      q = { text: fallback.text, answer: fallback.answer };
    }

    questions.push(q);
  }

  return questions;
}

const state = {
  difficulty: 1,
  questionCount: DEFAULT_QUESTION_COUNT,
  zeroSetting: "some",
  mode: "add",
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
  progressEl.textContent = `${state.index + 1} / ${state.questionCount}`;
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
    if (state.index + 1 >= state.questionCount) {
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

function start() {
  const difficulty = clampInt(difficultySelect.value, 1, 3, 1);
  const questionCount = clampInt(countSelect.value, 20, 45, 45);
  const zeroSetting = String(zeroSelect.value || "some");
  const mode = String(modeSelect.value);
  const zeroRate = zeroRateFromSetting(zeroSetting);

  state.difficulty = difficulty;
  state.questionCount = questionCount;
  state.zeroSetting = zeroSetting;
  state.mode = mode;
  state.questions = createQuestionSet(difficulty, mode, questionCount, zeroRate);
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
