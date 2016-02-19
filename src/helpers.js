'use babel'

/* @flow */

import FS from 'fs'
import Temp from 'tmp'
import promisify from 'sb-promisify'
import { getPath } from 'consistent-path'
import type { TextEditor } from 'atom'
import type { TempDirectory, ExecResult, ExecOptions } from './types'

let BufferedProcess
let BufferedNodeProcess
try {
  const Atom = require('atom')
  BufferedProcess = Atom.BufferedProcess
  BufferedNodeProcess = Atom.BufferedNodeProcess
} catch (_) {
  BufferedNodeProcess = BufferedProcess = function () {
    throw new Error('Process execution is not available')
  }
}

const COMMAND_NOT_RECOGNIZED_MESSAGE = 'is not recognized as an internal or external command'
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
    FS.access(filePath, FS.R_OK, function (error) {
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

export function validateEditor(editor: TextEditor) {
  let isEditor
  if (typeof atom.workspace.isTextEditor === 'function') {
    // Added in Atom v1.4.0
    isEditor = atom.workspace.isTextEditor(editor)
  } else {
    isEditor = typeof editor.getText === 'function'
  }
  if (!isEditor) {
    throw new Error('Invalid TextEditor provided')
  }
}

export function validateFind(directory: string, name: string | Array<string>) {
  if (typeof directory !== 'string') {
    throw new Error('Invalid or no `directory` provided')
  } else if (typeof name !== 'string' && !(name instanceof Array)) {
    throw new Error('Invalid or no `name` provided')
  }
}

export function exec(
  command: string,
  args: Array<string>,
  opts: ExecOptions,
  isNode: boolean
): Promise<ExecResult> {
  const options: ExecOptions = assign({
    env: assign({}, process.env),
    stream: 'stdout',
    throwOnStdErr: true
  }, opts)

  if (isNode && options.env) {
    delete options.env.OS
  }
  assign(options.env, { PATH: getPath() })

  return new Promise(function (resolve, reject) {
    const data = { stdout: [], stderr: [] }
    const handleError = function (error) {
      if (error && error.code === 'EACCES' ||
        (error && error.message && error.message.indexOf(COMMAND_NOT_RECOGNIZED_MESSAGE) !== -1)
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
      stdout(chunk) {
        data.stdout.push(chunk)
      },
      stderr(chunk) {
        data.stderr.push(chunk)
      },
      exit() {
        if (options.stream === 'stdout') {
          if (data.stderr.length && options.throwOnStdErr) {
            handleError(new Error(data.stderr.join('').trim()))
          } else {
            resolve(data.stdout.join('').trim())
          }
        } else if (options.stream === 'stderr') {
          resolve(data.stderr.join('').trim())
        } else {
          resolve({ stdout: data.stdout.join('').trim(), stderr: data.stderr.join('').trim() })
        }
      }
    }
    const spawnedProcess = isNode ?
      new BufferedNodeProcess(parameters) :
      new BufferedProcess(parameters)

    spawnedProcess.onWillThrowError(function ({ error }) {
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
