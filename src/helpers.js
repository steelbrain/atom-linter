'use babel'

/* @flow */

import Temp from 'tmp'
import type {TempDirectory} from './types'

export function getTempDirectory(prefix: string): Promise<TempDirectory> {
  return new Promise(function(resolve, reject) {
    Temp.dir({ prefix }, function(error, directory, cleanup) {
      if (error) {
        reject(error)
      } else resolve({ path: directory, cleanup })
    })
  })
}

export async function asyncSome<TItem, TReturn>(
  items: Array<TItem>,
  callback: ((item: TItem) => ?TReturn)
): Promise<?TReturn> {
  let toReturn = null
  for (const item of items) {
    toReturn = await callback(item)
    if (toReturn) {
      break
    }
  }
  return toReturn
}
