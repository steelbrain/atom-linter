declare module "sb-exec" {
  import type { SpawnOptions, ChildProcess } from "child_process";

  type OptionsAccepted = {
    timeout?: number | typeof Infinity; // In milliseconds
    stream?: "stdout" | "stderr" | "both";
    env: Record<string, string>;
    stdin?: string | Buffer;
    local?: {
      directory: string;
      prepend?: boolean;
    };
    /** @default `true` */
    throwOnStderr?: boolean;
    /** @default `false` */
    allowEmptyStderr?: boolean;
    ignoreExitCode?: boolean;
  } & SpawnOptions;

  /**
   * `then` callback is supposed to accept one of these results, depending on `options.stream`:
   * - `stdout` and `stderr` will result in a string, representing an stdout or stderr stream, respectively.
   * - `both` will result in an object of `{stdout, stderr, exitCode}` representing their respective streams and an exit code of a process.
   * - If `options.stream` is not provided it is assumed to be `stdout`, so a promise will result in a string representing an stdout stream.
   */
  export type Result =
    | string
    | { stdout: string; stderr: string; exitCode: number };

  type PromisedProcess = {
    then(callback: (spawnedProcess: ChildProcess) => void): Promise<Result>;
    catch(callback: (spawnedProcess: ChildProcess) => void): Promise<Result>;
    kill(signal: number): void;
  };

  export function exec(
    filePath: string,
    /** @default `[]` */
    parameters?: Array<string>,
    /** @default `{}` */
    options?: OptionsAccepted
  ): PromisedProcess;

  export function execNode(
    filePath: string,
    /** @default `[]` */
    parameters?: Array<string>,
    /** @default `{}` */
    options?: OptionsAccepted
  ): PromisedProcess;
}
