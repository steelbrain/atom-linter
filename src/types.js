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
