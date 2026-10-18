export type ChoiceId = "A" | "B" | "C" | "D";
export type Role = "strategy" | "social" | "courage" | "duty";
export type Tier = "early" | "middle" | "legend";
export type ChapterNo = 1 | 2 | 3 | 4;

export type Answers = Partial<Record<number, ChoiceId>>;
export type Scores = Record<Role, number>;

export interface Choice {
  id: ChoiceId;
  text: string;
  feedback: string;
}

export interface Question {
  id: number;
  chapter: ChapterNo;
  episode: number;
  title: string;
  context: string;
  key: boolean;
  choices: Choice[];
}

export interface Chapter {
  id: ChapterNo;
  eyebrow: string;
  title: string;
  episodes: string;
  description: string;
  hook: string;
  glyph: string;
}

export interface Ending {
  id: `${Role}_${Tier}`;
  role: Role;
  tier: Tier;
  episode: number;
  name: string;
  title: string;
  coverQuote: string;
  story: string[];
  strengths: string;
  shadow: string;
  counsel: string;
  quotes: [string, string, string];
}

export interface Evaluation {
  role: Role;
  tier: Tier;
  endingId: Ending["id"];
  scores: Scores;
  clues: number;
  allies: number;
  fateScore: number;
  choices: Record<number, ChoiceId>;
}