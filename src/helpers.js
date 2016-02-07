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

export const writeFile = promisify(FS.writeFile)
export const unlinkFile = promisify(FS.unlink)
