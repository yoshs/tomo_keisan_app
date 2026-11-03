try {
const { $, clampInt, randInt, pickOne, difficultyToMax, mountTimedQuiz } = window.TomoCommon;
const QUESTION_COUNT = 20;
function createAddProblem(maxSum) {
  const a = randInt(0, maxSum);
  const b = randInt(0, maxSum - a);
  return { text: `${a} + ${b} = ?`, answer: a + b };
}

function createKukuProblem() {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return { text: `${a} × ${b} = ?`, answer: a * b };
}

function createQuestionSet(difficulty) {
  const max = difficultyToMax(difficulty);
  const questions = [];
  for (let i = 0; i < QUESTION_COUNT; i += 1) {
    const kind = pickOne(["add", "kuku"]);
    questions.push(kind === "add" ? createAddProblem(max) : createKukuProblem());
  }
  return questions;
}

mountTimedQuiz(() => createQuestionSet(clampInt($("difficulty").value, 1, 3, 1)));

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
