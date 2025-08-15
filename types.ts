export enum AppState {
  IDLE,
  REQUESTING_MIC,
  RECORDING,
  RECORDING_COMPLETE,
  PROCESSING,
  SUCCESS,
  ERROR,
  HISTORY,
}

export interface Participant {
  name: string;
  role?: string;
}

export interface Topic {
  topic: string;
  keyIdeas: string[];
  quotes?: string[];
}

export interface Definition {
  term: string;
  definition: string;
}

export interface ActionItem {
  task: string;
  assignee: string;
}

export interface Notes {
  title: string;
  summary: string;
  participants: Participant[];
  topics: Topic[];
  definitions?: Definition[];
  decisions: string[];
  actionItems: ActionItem[];
}

export interface HistoryItem {
  id: string;
  title: string;
  createdAt: Date;
}
