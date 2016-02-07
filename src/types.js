'use babel'

/* @flow */

export type TempDirectory = {
  path: string,
  cleanup: (() => void)
}
