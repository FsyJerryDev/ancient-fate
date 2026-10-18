import type { Answers, ChoiceId, Evaluation, Role, Scores, Tier } from "./types.ts";

export const ROLE_BY_CHOICE: Record<ChoiceId, Role> = {
  A: "strategy",
  B: "social",
  C: "courage",
  D: "duty",
};

// 仅四道关键题影响命运：前三道计分/资源，最后一题根据资源判定。
const KEY_IMPACT: Record<number, Record<ChoiceId, 1 | 2>> = {
  4: { A: 2, B: 2, C: 1, D: 1 },
  8: { A: 1, B: 1, C: 2, D: 2 },
  12: { A: 2, B: 1, C: 2, D: 1 },
};

export const TOTAL_QUESTIONS = 16;
/** 虚构剧集的总长度；结果中第 X 集应当与此数字对照。 */
export const TOTAL_EPISODES = 90;
/** 中文短反馈按可见字符数展示 3 / 4 / 5 秒。 */
export function getFeedbackDurationMs(text: string): number {
  const count = Array.from(text.replace(/\s/g, "")).length;
  return count <= 20 ? 3000 : count <= 40 ? 4000 : 5000;
}

export const GAME_VERSION = "ancient-palace-v1";

export function isChoiceId(value: unknown): value is ChoiceId {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

export function isComplete(answers: Answers): answers is Record<number, ChoiceId> {
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
    if (!isChoiceId(answers[i])) return false;
  }
  return true;
}

/** 评分应始终从完整答案重算，避免返回改题后重复累加。 */
export function evaluate(answers: Answers): Evaluation {
  if (!isComplete(answers)) {
    throw new Error("必须回答全部 16 道题后才能结算。");
  }

  const scores: Scores = { strategy: 0, social: 0, courage: 0, duty: 0 };
  let clues = 0;
  let allies = 0;
  let fateScore = 0;

  for (let id = 1; id <= TOTAL_QUESTIONS; id++) {
    const choice = answers[id];
    scores[ROLE_BY_CHOICE[choice]] += 2;

    if (id === 4 || id === 8 || id === 12) {
      fateScore += KEY_IMPACT[id][choice];
      if (choice === "A" || choice === "C") clues++;
      else allies++;
    }
  }

  const finalChoice = answers[16];
  const usingClues = finalChoice === "A" || finalChoice === "C";
  const prepared = usingClues ? clues >= 2 : allies >= 2;
  fateScore += prepared ? 2 : 1;

  const highest = Math.max(...Object.values(scores));
  const tied = new Set(
    (Object.keys(scores) as Role[]).filter(role => scores[role] === highest)
  );
  let role: Role = ROLE_BY_CHOICE[answers[16]];
  // 最高分并列：从最后一题向前找最近命中的维度。
  for (let i = TOTAL_QUESTIONS; i >= 1; i--) {
    const currentRole = ROLE_BY_CHOICE[answers[i]];
    if (tied.has(currentRole)) {
      role = currentRole;
      break;
    }
  }

  const tier: Tier = fateScore >= 7 ? "legend" : fateScore === 6 ? "middle" : "early";
  return {
    role,
    tier,
    endingId: `${role}_${tier}`,
    scores,
    clues,
    allies,
    fateScore,
    choices: { ...answers },
  };
}

/** 数据驱动的短篇剧情：只读已发生的选择，不修改评分状态。 */
export function getStoryEcho(answers: Answers, completedChapter: number): string {
  if (completedChapter === 1) {
    const c = answers[4];
    return c === "A" || c === "C"
      ? "你握住了第一份关键线索，却还不知道谁会先发现你在查案。"
      : "你换来了一份珍贵的信任。但宫中每一份信任，都需要经受考验。";
  }
  if (completedChapter === 2) {
    const c4 = answers[4], c8 = answers[8];
    const clueCount = Number(c4 === "A" || c4 === "C") + Number(c8 === "A" || c8 === "C");
    return clueCount >= 2
      ? "两份互相呼应的线索终于指向同一处异常。你开始相信，这绝不是单纯的账目疏漏。"
      : clueCount === 0
        ? "已有两人愿意助你一臂之力。宫城里的人心，也许是你最大的筹码。"
        : "你有一条可疑线索，也有一位愿意相助的人。前路仍不明朗，但你不是毫无准备。";
  }
  if (completedChapter === 3) {
    const keyChoices = [answers[4], answers[8], answers[12]];
    const clues = keyChoices.filter(c => c === "A" || c === "C").length;
    return clues >= 2
      ? "旧账与今夜的伪证终于串成一条线。朝审之时，你或许能让证据替你说话。"
      : "有人在暗处回应你的善意。朝审之时，这些人愿不愿意站出来，将成为最大的悬念。";
  }
  return "";
}

export function getEndingEcho(evaluation: Evaluation): string {
  const final = evaluation.choices[16];
  const usingClues = final === "A" || final === "C";
  const ready = usingClues ? evaluation.clues >= 2 : evaluation.allies >= 2;
  if (ready && usingClues) return "你将一路保留下来的证据摆在殿前，薄薄几页纸终于有了改变局面的力量。";
  if (ready) return "你曾给予他人的信任在这一刻得到回应，几位关键人物终于愿意与你并肩。";
  if (usingClues) return "你选择相信手中的线索，可最重要的证据尚未连成完整的链条。";
  return "你试图用人心化解纷争，但此前的支持仍不够充分。";
}