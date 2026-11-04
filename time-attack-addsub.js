try {
  const common = window.TomoCommon;
  const { $, clampInt, randInt, shuffleInPlace } = common;
  const gradeEl = $("difficulty");
  const levelEl = $("level");
  const zeroEl = $("zero");

  const descriptions = {
    1: [
      "1けたどうし。たし算のこたえは10まで。ひき算は1けたの中で。",
      "たし算は1けたどうしで、こたえが10をこえる。ひき算は11〜18から1けたをひく、くり下がり。",
      "2けたと1けた。くり上がり・くり下がりなし。",
      "2けたと1けた。くり上がり・くり下がりあり。",
    ],
    2: [
      "2けたと1けた。くり上がり・くり下がりなし。",
      "2けたと1けた。くり上がり・くり下がりあり。",
      "2けたどうし。くり上がり・くり下がりなし。",
      "2けたどうし。くり上がり・くり下がりあり。",
    ],
    3: [
      "3けたと1〜2けた。くり上がり・くり下がりなし。",
      "3けたと1〜2けた。くり上がり・くり下がりあり。",
      "3けたどうし。くり上がり・くり下がりなし。",
      "3けたどうし。くり上がり・くり下がりあり。",
    ],
  };

  function updateLevel() {
    const grade = clampInt(gradeEl.value, 1, 3, 1);
    const level = clampInt(levelEl.value, 1, 4, 1);
    $("levelValue").value = String(level);
    levelEl.setAttribute("aria-valuetext", `むずかしさ ${level}`);
    $("levelDescription").textContent = descriptions[grade][level - 1];
    // 0を使う問題は、くり上がり・くり下がりの練習にならないため除外。
    zeroEl.disabled = level % 2 === 0 || (grade >= 2 && level >= 3);
  }

  function ranges(grade, level, op) {
    if (grade === 1 && level <= 2) {
      return { minA: op === "sub" && level === 2 ? 11 : 1,
        maxA: op === "sub" && level === 2 ? 18 : 9, minB: 1, maxB: 9 };
    }
    const digits = Math.max(2, grade);
    return { minA: 10 ** (digits - 1), maxA: 10 ** digits - 1,
      minB: grade >= 2 && level >= 3 ? 10 ** (digits - 1) : 1,
      maxB: grade >= 2 && level >= 3 ? 10 ** digits - 1 : 10 ** (digits - 1) - 1 };
  }

  function hasCarry(a, b, op) {
    while (a > 0 || b > 0) {
      const x = a % 10;
      const y = b % 10;
      if (op === "add" ? x + y >= 10 : x < y) return true;
      a = Math.floor(a / 10);
      b = Math.floor(b / 10);
    }
    return false;
  }

  function makeProblem(a, b, op) {
    return { text: `${a} ${op === "add" ? "+" : "−"} ${b} = ?`,
      answer: op === "add" ? a + b : a - b };
  }

  function createProblem(grade, level, op, zeroRate) {
    const { minA, maxA, minB, maxB } = ranges(grade, level, op);
    if (level % 2 === 1 && minB === 1 && Math.random() < zeroRate) {
      const a = randInt(minA, maxA);
      return makeProblem(a, 0, op);
    }
    // 通常の出題は、桁数とくりの条件を満たす組み合わせだけ採用。
    for (let tries = 0; tries < 200; tries++) {
      const a = randInt(minA, maxA);
      const b = randInt(minB, maxB);
      if (op === "sub" && a <= b) continue;
      if (grade === 1 && level === 1) {
        if (op === "add" && a + b > 10) continue;
      } else if (grade === 1 && level === 2 && op === "add") {
        if (a + b <= 10) continue;
      } else if (hasCarry(a, b, op) !== (level % 2 === 0)) continue;
      return makeProblem(a, b, op);
    }
    // 乱数が偏っても必ず条件を満たす問題で終了する。
    if (grade === 1 && level <= 2) {
      return level === 1 ? makeProblem(3, 2, op) :
        op === "add" ? makeProblem(8, 7, op) : makeProblem(13, 7, op);
    }
    const base = 10 ** (Math.max(2, grade) - 1);
    if (level % 2 === 1) return makeProblem(3 * base + 3, minB + 1, op);
    return op === "add" ? makeProblem(base + 8, minB + 7, op) :
      makeProblem(3 * base + 1, minB + 7, op);
  }

  function createQuestionSet() {
    const grade = clampInt(gradeEl.value, 1, 3, 1);
    const level = clampInt(levelEl.value, 1, 4, 1);
    const count = clampInt($("count").value, 20, 45, 20);
    const mode = $("mode").value;
    const zeroRate = zeroEl.value === "many" ? 0.25 : zeroEl.value === "some" ? 0.1 : 0;
    const ops = mode === "mix" ? shuffleInPlace([
      ...Array(Math.floor(count / 2)).fill("add"), ...Array(Math.ceil(count / 2)).fill("sub"),
    ]) : Array(count).fill(mode);
    const used = new Set();
    return ops.map(op => {
      let q;
      // 易しい設定では候補が少ないため、重複回避の試行数を制限する。
      for (let tries = 0; tries < 40; tries++) {
        q = createProblem(grade, level, op, zeroRate);
        const [a, b] = q.text.match(/\d+/g).map(Number);
        const key = op === "add" ? `${Math.min(a, b)}+${Math.max(a, b)}` : `${a}-${b}`;
        if (!used.has(key)) { used.add(key); break; }
      }
      return q;
    });
  }

  gradeEl.addEventListener("change", updateLevel);
  levelEl.addEventListener("input", updateLevel);
  updateLevel();
  common.mountTimedQuiz(createQuestionSet);
} catch (err) {
  window.TomoCommon?.showFatalError(String(err.stack || err));
  throw err;
}
