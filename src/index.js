'use babel'

/* @flow */

import invariant from 'assert'
import { BufferedProcess, BufferedNodeProcess } from 'atom'
import * as Path from 'path'
import * as FS from 'fs'
import * as TMP from 'tmp'
import { getPath } from 'consistent-path'

let NamedRegexp = null
export const FindCache = new Map()

const COMMAND_NOT_RECOGNIZED_MESSAGE = 'is not recognized as an internal or external command'
// TODO: Remove this when electron upgrades node
const assign = Object.assign || function (target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key]
    }
  }
  return target
}

function _exec(command, args, opts, isNode) {
  const options = assign({
    env: assign({}, process.env),
    stream: 'stdout',
    throwOnStdErr: true
  }, opts)

  if (isNode) {
    delete options.env.OS
  }
  assign(options.env, { PATH: getPath() })

  return new Promise((resolve, reject) => {
    const data = { stdout: [], stderr: [] }
    const handleError = error => {
      if (error.code === 'EACCES' ||
        (error.message && error.message.indexOf(COMMAND_NOT_RECOGNIZED_MESSAGE) !== -1)
      ) {
        const newError = new Error(`Failed to spawn command '${command}'.` +
          ` Make sure it's a file, not a directory, and it's executable.`)
        newError.name = 'BufferedProcessError'
        reject(newError)
      }
      reject(error)
    }
    const parameters = {
      command,
      args,
      options,
      stdout: chunk => {
        data.stdout.push(chunk)
      },
      stderr: chunk => {
        data.stderr.push(chunk)
      },
      exit: () => {
        if (options.stream === 'stdout') {
          if (data.stderr.length && options.throwOnStdErr) {
            handleError(new Error(data.stderr.join('')))
          } else {
            resolve(data.stdout.join(''))
          }
        } else if (options.stream === 'stderr') {
          resolve(data.stderr.join(''))
        } else {
          resolve({ stdout: data.stdout.join(''), stderr: data.stderr.join('') })
        }
      }
    }
    const spawnedProcess = isNode ?
      new BufferedNodeProcess(parameters) :
      new BufferedProcess(parameters)

    spawnedProcess.onWillThrowError(({ error }) => {
      handleError(error)
    })

    if (options.stdin) {
      try {
        spawnedProcess.process.stdin.write(options.stdin.toString())
        spawnedProcess.process.stdin.end()
      } catch (_) {
        // Do nothing
      }
    }
  })
}

function _validateExec(command, args, options) {
  if (typeof command !== 'string') {
    throw new Error('Invalid or no `command` provided')
  } else if (!(args instanceof Array)) {
    throw new Error('Invalid or no `args` provided')
  } else if (typeof options !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }
}

function _validateFind(directory, name) {
  if (typeof directory !== 'string') {
    throw new Error('Invalid or no `directory` provided')
  } else if (typeof name !== 'string' && !(name instanceof Array)) {
    throw new Error('Invalid or no `name` provided')
  }
}

function _validateEditor(editor) {
  let isEditor
  if (typeof atom.workspace.isTextEditor === 'function') {
    // Added in Atom v1.4.0
    isEditor = atom.workspace.isTextEditor(editor)
  } else {
    isEditor = typeof editor.getText !== 'function'
  }
  if (!isEditor) {
    throw new Error('Invalid TextEditor provided')
  }
}

export function exec(command, args = [], options = {}) {
  _validateExec(command, args, options)
  return _exec(command, args, options, false)
}

export function execNode(command, args = [], options = {}) {
  _validateExec(command, args, options)
  return _exec(command, args, options, true)
}

export function rangeFromLineNumber(textEditor, line, column) {
  _validateEditor(textEditor)
  let lineNumber = line

  if (!Number.isFinite(lineNumber) || Number.isNaN(lineNumber) || lineNumber < 0) {
    lineNumber = 0
  }

  const buffer = textEditor.getBuffer()
  const lineMax = buffer.getLineCount() - 1

  if (lineNumber > lineMax) {
    throw new Error(`Line number (${lineNumber}) greater than maximum line (${lineMax})`)
  }

  let colStart = column
  if (!Number.isFinite(colStart) || Number.isNaN(colStart) || colStart < 0) {
    const indentation = buffer.lineForRow(lineNumber).match(/^\s+/)
    if (indentation && indentation.length) {
      colStart = indentation[0].length
    } else {
      colStart = 0
    }
  }

  const lineLength = buffer.lineLengthForRow(lineNumber)

  if (colStart > lineLength) {
    throw new Error(`Column start (${colStart}) greater than line length (${lineLength})`)
  }

  return [
    [lineNumber, colStart],
    [lineNumber, lineLength]
  ]
}

export function findAsync(directory, name) {
  _validateFind(directory, name)
  const names = name instanceof Array ? name : [name]
  const chunks = directory.split(Path.sep)
  let promise = Promise.resolve(null)

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep)
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/')
    }
    promise = promise.then(filePath => {
      if (filePath !== null) {
        return filePath
      }
      return names.reduce((promise2, name2) => {
        const currentFile = Path.join(currentDir, name2)
        return promise2.then(filePath2 => {
          if (filePath2 !== null) {
            return filePath2
          }
          return new Promise(resolve => {
            FS.access(currentFile, FS.R_OK, error => {
              if (error) {
                resolve(null)
              } else resolve(currentFile)
            })
          })
        })
      }, Promise.resolve(null))
    })
    chunks.pop()
  }

  return promise
}

export function findCachedAsync(directory, name) {
  _validateFind(directory, name)
  const names = name instanceof Array ? name : [name]
  const cacheKey = `${directory}:${names.join(',')}`

  let finalValue = null

  if (FindCache.has(cacheKey)) {
    const cachedFilePath = FindCache.get(cacheKey)
    finalValue = new Promise(resolve => {
      FS.access(cachedFilePath, FS.R_OK, error => {
        if (error) {
          FindCache.delete(cacheKey)
          resolve(findCachedAsync(directory, names))
        } else resolve(cachedFilePath)
      })
    })
  } else {
    finalValue = findAsync(directory, name).then(filePath => {
      FindCache.set(cacheKey, filePath)
      return filePath
    })
  }

  return finalValue
}

export function find(directory, name) {
  _validateFind(directory, name)
  const names = name instanceof Array ? name : [name]
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

export function findCached(directory, name) {
  _validateFind(directory, name)
  const names = name instanceof Array ? name : [name]
  const cacheKey = `${directory}:${names.join(',')}`

  if (FindCache.has(cacheKey)) {
    const cachedFilePath = FindCache.get(cacheKey)
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

export function tempFiles(files, callback) {
  if (!Array.isArray(files)) {
    throw new Error('Invalid or no `files` provided')
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided')
  }

  return new Promise((resolve, reject) => {
    TMP.dir({
      prefix: 'atom-linter_'
    }, (error, directory, directoryCleanup) => {
      if (error) {
        directoryCleanup()
        return reject(error)
      }
      let foundError = false
      let filePaths = null
      Promise.all(files.map(file => {
        const fileName = file.name
        const fileContents = file.contents
        const filePath = Path.join(directory, fileName)
        return new Promise((resolve2, reject2) => {
          FS.writeFile(filePath, fileContents, error2 => {
            if (error2) {
              // Note: Intentionally not doing directoryCleanup 'cause it won't work
              // Because we would've already wrote a few files and when even file
              // exists in a directory, it can't be removed
              reject2(error2)
            } else resolve2(filePath)
          })
        })
      })).then(_filePaths =>
        callback(filePaths = _filePaths)
      ).catch(result => {
        foundError = true
        return result
      }).then(result => {
        if (filePaths !== null) {
          Promise.all(filePaths.map(filePath =>
            new Promise(resolve3 => {
              FS.unlink(filePath, resolve3)
            })
          )).then(directoryCleanup)
        }
        if (foundError) {
          throw result
        } else return result
      }).then(resolve, reject)
    })
  })
}

export function tempFile(fileName, fileContents, callback) {
  if (typeof fileName !== 'string') {
    throw new Error('Invalid or no `fileName` provided')
  } else if (typeof fileContents !== 'string') {
    throw new Error('Invalid or no `fileContents` provided')
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided')
  }

  return tempFiles([{
    name: fileName,
    contents: fileContents
  }], results =>
    callback(results[0])
  )
}

export function parse(data, regex, opts = {}) {
  if (typeof data !== 'string') {
    throw new Error('Invalid or no `data` provided')
  } else if (typeof regex !== 'string') {
    throw new Error('Invalid or no `regex` provided')
  } else if (typeof opts !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }

  if (NamedRegexp === null) {
    NamedRegexp = require('named-js-regexp')
  }

  const options = assign({ flags: '' }, opts)
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
      ]
    })

    rawMatch = compiledRegexp.exec(data)
  }

  return messages
}