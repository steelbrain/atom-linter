'use babel'

/* @flow */

import FS from 'fs'
import Temp from 'tmp'
import promisify from 'sb-promisify'
import type { TempDirectory } from './types'

export function getTempDirectory(prefix: string): Promise<TempDirectory> {
  return new Promise(function (resolve, reject) {
    Temp.dir({ prefix }, function (error, directory, cleanup) {
      if (error) {
        reject(error)
      } else resolve({ path: directory, cleanup })
    })
  })
}

export function fileExists(filePath: string): Promise<boolean> {
  return new Promise(function (resolve) {
    // 4 = FS.R_OK ; Flow doesn't recognize it yet (facebook/flow#1342) so hard-coding
    FS.access(filePath, 4, function (error) {
      resolve(error === null)
    })
  })
}

export function validateExec(command: string, args: Array<string>, options: Object) {
  if (typeof command !== 'string') {
    throw new Error('Invalid or no `command` provided')
  } else if (!(args instanceof Array)) {
    throw new Error('Invalid or no `args` provided')
  } else if (typeof options !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }
}

export const writeFile = promisify(FS.writeFile)
export const unlinkFile = promisify(FS.unlink)
export const assign = Object.assign || function (target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key]
    }
  }
  return target
}
