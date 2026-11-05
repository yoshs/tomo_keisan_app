(() => {
  "use strict";
  const { $, toHalfWidthDigits, formatMs, startTicker, nowMs, beep, celebrateCorrect, encourageWrong, createScoreboard, mountNumpad, createTransition } = window.TomoCommon;
  window.TomoCommon.mountTimedQuiz = function (createQuestions) {
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

    const score = createScoreboard();
    const transition = createTransition();
    const state = {
      questions: [],
      index: 0,
      mistakes: 0,
      startMs: 0,
      stopTick: null,
      busy: false,
      active: false,
    };

    function resetFeedback() {
      feedback.textContent = "";
      feedback.classList.remove("ok", "ng");
    }

    function updateHeader() {
      progressEl.textContent = `${state.index + 1} / ${state.questions.length}`;
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
      state.active = false;
      showScreen("result");
    }

    function parseAnswer() {
      const raw = toHalfWidthDigits(answerInput.value).trim();
      if (!raw) return { ok: false, message: "こたえを いれてね" };
      const n = /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return { ok: false, message: "すうじで いれてね" };
      return { ok: true, value: n };
    }

    function sanitizeDigits(value) {
      return toHalfWidthDigits(value).replace(/[^0-9]/g, "");
    }

    function handleCorrect() {
      if (!state.active || state.busy) return;
      state.busy = true;
      feedback.textContent = "せいかい！";
      feedback.classList.remove("ng");
      feedback.classList.add("ok");
      beep(true);
      celebrateCorrect(score.record(true).combo);
      transition.schedule(() => {
        if (state.index + 1 >= state.questions.length) {
          finish();
          return;
        }
        state.index += 1;
        showQuestion();
      }, 220);
    }

    function handleWrong() {
      if (!state.active || state.busy) return;
      state.mistakes += 1;
      score.record(false);
      encourageWrong();
      feedback.textContent = "ちがうよ！";
      feedback.classList.remove("ok");
      feedback.classList.add("ng");
      beep(false);
      updateHeader();
      answerInput.value = "";
      answerInput.focus();
    }

    function autoJudge() {
      if (!state.active || state.busy) return;
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
      if (!state.active || state.busy) return;
      const parsed = parseAnswer();
      if (!parsed.ok) {
        feedback.textContent = parsed.message;
        feedback.classList.remove("ok");
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

    mountNumpad({ inputEl: answerInput, containerEl: numpad, isDisabled: () => !state.active || state.busy });

    function start() {
      score.reset();
      transition.cancel();
      stopTimer();
      state.questions = createQuestions();
      state.active = true;
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

    window.addEventListener("pagehide", () => {
      state.active = false;
      transition.cancel();
      stopTimer();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) showScreen("setup");
    });

    showScreen("setup");

  };
})();
