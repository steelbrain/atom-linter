'use babel'

/* @flow */

export type TempDirectory = {
  path: string,
  cleanup: (() => void)
}

export type TempFiles = {
  name: string,
  contents: string
}

export type ExecResult = string | {
  stdout: string,
  stderr: string
}

export type ExecOptions = {
  env?: Object,
  stream?: 'stdout' | 'stderr' | 'both',
  throwOnStdErr?: boolean
}
