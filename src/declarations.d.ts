declare module '@actions/core' {
  export function getInput(name: string, options?: { required: boolean }): string;
  export function setOutput(name: string, value: any): void;
  export function debug(message: string): void;
  export function info(message: string): void;
  export function warning(message: string): void;
  export function error(message: string): void;
  export function setFailed(message: string): void;
}

declare module '@actions/github' {
  export function getOctokit(token: string): any;
}

declare module 'simple-git' {
  interface SimpleGit {
    clone(repoUrl: string, localPath: string): Promise<void>;
  }

  function simpleGit(): SimpleGit;
  export default simpleGit;
} 