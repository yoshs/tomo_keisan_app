try {
const { shuffleInPlace, mountTimedQuiz } = window.TomoCommon;
const QUESTION_COUNT = 20;
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

mountTimedQuiz(createKukuSet);

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
