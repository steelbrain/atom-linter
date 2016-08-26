'use babel'

/* @flow */

import * as Path from 'path'
import * as FS from 'fs'
import { Range } from 'atom'
import { exec, execNode } from 'sb-exec'
import type { TextEditor } from 'atom'
import * as Helpers from './helpers'
import type { TempFiles } from './types'

let NamedRegexp = null
export const FindCache = new Map()

export function rangeFromLineNumber(textEditor: TextEditor, line: ?number, column: ?number): Range {
  Helpers.validateEditor(textEditor)
  let lineNumber = line

  if (typeof lineNumber !== 'number' || !Number.isFinite(lineNumber) || lineNumber < 0) {
    lineNumber = 0
  }

  const buffer = textEditor.getBuffer()
  const lineMax = buffer.getLineCount() - 1

  if (lineNumber > lineMax) {
    throw new Error(`Line number (${lineNumber}) greater than maximum line (${lineMax})`)
  }

  const columnGiven = typeof column === 'number' && Number.isFinite(column) && column > -1
  const lineText = buffer.lineForRow(lineNumber)
  let colEnd = lineText.length
  let colStart = columnGiven ? column : 0
  if (columnGiven) {
    const match = Helpers.getWordRegexp(textEditor, [lineNumber, colStart]).exec(lineText.substr(column))
    if (match) {
      colEnd = colStart + match.index + match[0].length
    }
  } else {
    const indentation = lineText.match(/^\s+/)
    if (indentation) {
      colStart = indentation[0].length
    }
  }
  if (colStart > lineText.length) {
    throw new Error(`Column start (${colStart || 0}) greater than line length (${lineText.length})`)
  }

  return Range.fromObject([
    [lineNumber, colStart],
    [lineNumber, colEnd],
  ])
}

export async function findAsync(directory: string, name: string | Array<string>): Promise<?string> {
  Helpers.validateFind(directory, name)
  const names = [].concat(name)
  const chunks = directory.split(Path.sep)

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep)
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/')
    }
    for (const fileName of names) {
      const filePath = Path.join(currentDir, fileName)
      if (await Helpers.fileExists(filePath)) {
        return filePath
      }
    }
    chunks.pop()
  }

  return null
}

export async function findCachedAsync(
  directory: string, name: string | Array<string>
): Promise<?string> {
  Helpers.validateFind(directory, name)
  const names = [].concat(name)
  const cacheKey = `${directory}:${names.join(',')}`
  const cachedFilePath = FindCache.get(cacheKey)

  if (cachedFilePath) {
    if (await Helpers.fileExists(cachedFilePath)) {
      return cachedFilePath
    }
    FindCache.delete(cacheKey)
  }
  const filePath = await findAsync(directory, names)
  if (filePath) {
    FindCache.set(cacheKey, filePath)
  }
  return filePath
}

export function find(directory: string, name: string | Array<string>): ?string {
  Helpers.validateFind(directory, name)
  const names = [].concat(name)
  const chunks = directory.split(Path.sep)

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep)
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/')
    }
    for (const fileName of names) {
      const filePath = Path.join(currentDir, fileName)

      try {
        FS.accessSync(filePath, FS.R_OK)
        return filePath
      } catch (_) {
        // Do nothing
      }
    }
    chunks.pop()
  }

  return null
}

export function findCached(directory: string, name: string | Array<string>): ?string {
  Helpers.validateFind(directory, name)
  const names = [].concat(name)
  const cacheKey = `${directory}:${names.join(',')}`
  const cachedFilePath = FindCache.get(cacheKey)

  if (cachedFilePath) {
    try {
      FS.accessSync(cachedFilePath, FS.R_OK)
      return cachedFilePath
    } catch (_) {
      FindCache.delete(cacheKey)
    }
  }
  const filePath = find(directory, names)
  if (filePath) {
    FindCache.set(cacheKey, filePath)
  }
  return filePath
}

export async function tempFiles<T>(
  files: Array<TempFiles>,
  callback: ((filePaths: Array<string>) => Promise<T>)
): Promise<T> {
  if (!Array.isArray(files)) {
    throw new Error('Invalid or no `files` provided')
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided')
  }

  const tempDirectory = await Helpers.getTempDirectory('atom-linter_')
  const filePaths = []

  await Promise.all(files.map(function (file) {
    const fileName = file.name
    const fileContents = file.contents
    const filePath = Path.join(tempDirectory.path, fileName)
    filePaths.push(filePath)
    return Helpers.writeFile(filePath, fileContents)
  }))
  try {
    return await callback(filePaths)
  } finally {
    await Promise.all(filePaths.map(function (filePath) {
      return Helpers.unlinkFile(filePath)
    }))
    tempDirectory.cleanup()
  }
}

export function tempFile<T>(
  fileName: string,
  fileContents: string,
  callback: ((filePath: string) => Promise<T>)
): Promise<T> {
  if (typeof fileName !== 'string') {
    throw new Error('Invalid or no `fileName` provided')
  } else if (typeof fileContents !== 'string') {
    throw new Error('Invalid or no `fileContents` provided')
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided')
  }

  return tempFiles([{
    name: fileName,
    contents: fileContents,
  }], function (results) {
    return callback(results[0])
  })
}

export function parse(data: string, regex: string, givenOptions: { flags?: string, filePath?: string } = {}) {
  if (typeof data !== 'string') {
    throw new Error('Invalid or no `data` provided')
  } else if (typeof regex !== 'string') {
    throw new Error('Invalid or no `regex` provided')
  } else if (typeof givenOptions !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }

  if (NamedRegexp === null) {
    /* eslint-disable global-require */
    NamedRegexp = require('named-js-regexp')
    /* eslint-enable global-require */
  }

  const defaultOptions: Object = { flags: '' }
  const options = Object.assign(defaultOptions, givenOptions)
  if (options.flags.indexOf('g') === -1) {
    options.flags += 'g'
  }

  const messages = []
  const compiledRegexp = new NamedRegexp(regex, options.flags)
  let rawMatch = compiledRegexp.exec(data)

  while (rawMatch !== null) {
    const match = rawMatch.groups()
    const type = match.type
    const text = match.message
    const file = match.file || options.filePath || null

    const lineStart = match.lineStart || match.line || 0
    const colStart = match.colStart || match.col || 0
    const lineEnd = match.lineEnd || match.line || 0
    const colEnd = match.colEnd || match.col || 0

    messages.push({
      type,
      text,
      filePath: file,
      range: [
        [lineStart > 0 ? lineStart - 1 : 0, colStart > 0 ? colStart - 1 : 0],
        [lineEnd > 0 ? lineEnd - 1 : 0, colEnd > 0 ? colEnd - 1 : 0],
      ],
    })

    rawMatch = compiledRegexp.exec(data)
  }

  return messages
}

export { exec, execNode }
