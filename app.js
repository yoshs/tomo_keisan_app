const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
};

const STORAGE_KEY = "tomo_keisan_settings_v1";

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toHalfWidthDigits(text) {
  return String(text).replace(
    /[０-９]/g,
    (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(items) {
  return items[randInt(0, items.length - 1)];
}

function defaultOpsForGrade(grade) {
  switch (grade) {
    case 1:
      return ["+", "-"];
    case 2:
      return ["+", "-"];
    case 3:
      return ["+", "-", "×", "÷"];
    default:
      return ["+", "-"];
  }
}

function gradeRanges(grade) {
  if (grade === 1) return { maxAddSum: 20, maxSubA: 20 };
  if (grade === 2) return { maxAddSum: 100, maxSubA: 100 };
  return { maxAddSum: 1000, maxSubA: 1000 };
}

function createProblem(grade, op) {
  const { maxAddSum, maxSubA } = gradeRanges(grade);

  if (op === "+") {
    const a = randInt(0, maxAddSum);
    const b = randInt(0, maxAddSum - a);
    return {
      a,
      b,
      op,
      answer: a + b,
      text: `${a} + ${b} = ?`,
    };
  }

  if (op === "-") {
    const a = randInt(0, maxSubA);
    const b = randInt(0, a);
    return {
      a,
      b,
      op,
      answer: a - b,
      text: `${a} − ${b} = ?`,
    };
  }

  if (op === "×") {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    return {
      a,
      b,
      op,
      answer: a * b,
      text: `${a} × ${b} = ?`,
    };
  }

  // ÷ (わりきれる もんだい)
  const divisor = randInt(1, 9);
  const quotient = randInt(1, 9);
  const dividend = divisor * quotient;
  return {
    a: dividend,
    b: divisor,
    op,
    answer: quotient,
    text: `${dividend} ÷ ${divisor} = ?`,
  };
}

function createQuestionSet(grade, count, ops) {
  const questions = [];
  for (let i = 0; i < count; i += 1) {
    const op = pickOne(ops);
    questions.push(createProblem(grade, op));
  }
  return questions;
}

let audioCtx;
function beep(ok) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 220;

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch {
    // 音が鳴らなくても OK（無音環境など）
  }
}

const screens = {
  setup: $("screen-setup"),
  quiz: $("screen-quiz"),
  result: $("screen-result"),
};

const gradeSelect = $("grade");
const questionCountSelect = $("questionCount");

const opAdd = $("opAdd");
const opSub = $("opSub");
const opMul = $("opMul");
const opDiv = $("opDiv");

const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const submitBtn = $("submitBtn");
const answerInput = $("answerInput");
const problemText = $("problemText");
const feedback = $("feedback");
const statusProgress = $("statusProgress");
const statusScore = $("statusScore");

const resultScore = $("resultScore");
const resultDetail = $("resultDetail");
const mistakesBox = $("mistakes");
const mistakeList = $("mistakeList");
const againBtn = $("againBtn");
const backBtn = $("backBtn");

// 画面テンキー（スマホ/タブレット向け）
function mountNumpad() {
  const numpad = document.getElementById("numpad");
  if (!numpad) return;
  if (numpad.dataset.numpadBound) return;
  numpad.dataset.numpadBound = "1";

  numpad.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest("button");
    if (!(btn instanceof HTMLButtonElement)) return;

    const value = btn.dataset.value;
    const action = btn.dataset.action;

    answerInput.focus();

    if (value != null) {
      answerInput.value = String(answerInput.value || "") + value;
      return;
    }
    if (action === "backspace") {
      answerInput.value = String(answerInput.value || "").slice(0, -1);
      return;
    }
    if (action === "clear") {
      answerInput.value = "";
      return;
    }
    if (action === "enter") {
      submitAnswer();
    }
  });
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

function readSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      grade: 1,
      count: 10,
      ops: defaultOpsForGrade(1),
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const grade = clampInt(parsed.grade, 1, 3, 1);
    const count = clampInt(parsed.count, 5, 50, 10);
    const ops = Array.isArray(parsed.ops) ? parsed.ops : defaultOpsForGrade(grade);
    const allowed = ["+", "-", "×", "÷"];
    const filtered = ops.filter((o) => allowed.includes(o));
    return {
      grade,
      count,
      ops: filtered.length ? filtered : defaultOpsForGrade(grade),
    };
  } catch {
    return {
      grade: 1,
      count: 10,
      ops: defaultOpsForGrade(1),
    };
  }
}

function writeSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function setOpsCheckboxes(ops) {
  opAdd.checked = ops.includes("+");
  opSub.checked = ops.includes("-");
  opMul.checked = ops.includes("×");
  opDiv.checked = ops.includes("÷");
}

function getOpsFromCheckboxes() {
  const ops = [];
  if (opAdd.checked) ops.push("+");
  if (opSub.checked) ops.push("-");
  if (opMul.checked) ops.push("×");
  if (opDiv.checked) ops.push("÷");
  return ops;
}

function applySettingsToUI(settings) {
  gradeSelect.value = String(settings.grade);
  questionCountSelect.value = String(settings.count);
  setOpsCheckboxes(settings.ops);
}

function currentSettingsFromUI() {
  const grade = clampInt(gradeSelect.value, 1, 3, 1);
  const count = clampInt(questionCountSelect.value, 5, 50, 10);
  const ops = getOpsFromCheckboxes();
  return { grade, count, ops };
}

const quizState = {
  grade: 1,
  count: 10,
  ops: ["+", "-"],
  questions: [],
  index: 0,
  correct: 0,
  mistakes: [],
};

function updateStatus() {
  statusProgress.textContent = `${quizState.index + 1} / ${quizState.count}`;
  const score = Math.round((quizState.correct / quizState.count) * 100);
  statusScore.textContent = `${score}てん`;
}

function showProblem() {
  const q = quizState.questions[quizState.index];
  problemText.textContent = q.text;
  feedback.textContent = "";
  feedback.classList.remove("ok", "ng");
  answerInput.value = "";
  updateStatus();
  answerInput.focus();
}

function finishQuiz() {
  const score = Math.round((quizState.correct / quizState.count) * 100);
  resultScore.textContent = String(score);
  resultDetail.textContent = `${quizState.count}もん中 ${quizState.correct}もん せいかい`;

  mistakeList.innerHTML = "";
  if (quizState.mistakes.length) {
    quizState.mistakes.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = `${m.text.replace("?", m.userAnswer)} → こたえ：${m.answer}`;
      mistakeList.appendChild(li);
    });
    mistakesBox.classList.remove("hidden");
  } else {
    mistakesBox.classList.add("hidden");
  }

  showScreen("result");
}

function submitAnswer() {
  const raw = toHalfWidthDigits(answerInput.value).trim();
  if (!raw) {
    feedback.textContent = "こたえを いれてね";
    feedback.classList.add("ng");
    answerInput.focus();
    return;
  }

  const userAnswer = Number.parseInt(raw, 10);
  if (!Number.isFinite(userAnswer)) {
    feedback.textContent = "すうじで いれてね";
    feedback.classList.add("ng");
    answerInput.focus();
    return;
  }

  const q = quizState.questions[quizState.index];
  const ok = userAnswer === q.answer;

  if (ok) {
    quizState.correct += 1;
    feedback.textContent = "せいかい！";
    feedback.classList.add("ok");
  } else {
    feedback.textContent = `ざんねん… こたえは ${q.answer}`;
    feedback.classList.add("ng");
    quizState.mistakes.push({
      text: q.text,
      answer: q.answer,
      userAnswer,
    });
  }

  beep(ok);
  updateStatus();

  window.setTimeout(() => {
    if (quizState.index + 1 >= quizState.count) {
      finishQuiz();
      return;
    }
    quizState.index += 1;
    showProblem();
  }, 650);
}

function startQuiz() {
  const settings = currentSettingsFromUI();
  if (!settings.ops.length) {
    alert("けいさんの しゅるいを 1つ えらんでね");
    return;
  }

  writeSettings(settings);

  quizState.grade = settings.grade;
  quizState.count = settings.count;
  quizState.ops = settings.ops;
  quizState.questions = createQuestionSet(settings.grade, settings.count, settings.ops);
  quizState.index = 0;
  quizState.correct = 0;
  quizState.mistakes = [];

  showScreen("quiz");
  showProblem();
}

function resetToSetup() {
  showScreen("setup");
}

function applyDefaultOpsFromGrade() {
  const grade = clampInt(gradeSelect.value, 1, 3, 1);
  setOpsCheckboxes(defaultOpsForGrade(grade));
}

// Events
startBtn.addEventListener("click", startQuiz);
restartBtn.addEventListener("click", startQuiz);
submitBtn.addEventListener("click", submitAnswer);
againBtn.addEventListener("click", startQuiz);
backBtn.addEventListener("click", resetToSetup);

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();
});

gradeSelect.addEventListener("change", () => {
  applyDefaultOpsFromGrade();
});

// Init
const initial = readSettings();
applySettingsToUI(initial);
mountNumpad();
showScreen("setup");
