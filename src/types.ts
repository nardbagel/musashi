// Comment types
export interface BaseComment {
  type: 'line' | 'pr';
  body: string;
}

export interface LineComment extends BaseComment {
  type: 'line';
  file: string;
  line: number;
  commit_id?: string;
}

export interface PRComment extends BaseComment {
  type: 'pr';
}

export type Comment = LineComment | PRComment;

// Analysis results
export interface AnalysisResults {
  comments: Comment[];
  summary: string;
}

// Configuration rules
export interface CommentRules {
  customInstructions?: string;
  [key: string]: any;
}

// LLM Provider types
export type LLMProvider = 'openai' | 'anthropic';

// Octokit type
export type OctokitType = any;

// API Response types
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

// Axios error type
export interface AxiosError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

// Declare isAxiosError function
declare module 'axios' {
  export function isAxiosError(error: any): error is AxiosError;
} 