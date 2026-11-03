try {
const common = window.TomoCommon;
const { $, clampInt, randInt, difficultyToMax } = common;
const DEFAULT_QUESTION_COUNT = 20;
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


common.mountTimedQuiz(() => createQuestionSet(
  clampInt($("difficulty").value, 1, 3, 1),
  $("mode").value,
  clampInt($("count").value, 20, 45, DEFAULT_QUESTION_COUNT),
  zeroRateFromSetting($("zero").value)
));

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
