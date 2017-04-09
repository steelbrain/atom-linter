'use babel'

/* @flow */

import FS from 'fs'
import Temp from 'tmp'
import promisify from 'sb-promisify'
import type { TextEditor, Range } from 'atom'
import type { TempDirectory } from './types'

export const writeFile = promisify(FS.writeFile)
export const unlinkFile = promisify(FS.unlink)

function escapeRegexp(string: string): string {
  // Shamelessly stolen from https://github.com/atom/underscore-plus/blob/130913c179fe1d718a14034f4818adaf8da4db12/src/underscore-plus.coffee#L138
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export function getWordRegexp(textEditor: TextEditor, bufferPosition: Range) {
  const scopeDescriptor = textEditor.scopeDescriptorForBufferPosition(bufferPosition)
  const nonWordCharacters = escapeRegexp(atom.config.get('editor.nonWordCharacters', {
    scope: scopeDescriptor,
  }))
  return new RegExp(`^[\t ]*$|[^\\s${nonWordCharacters}]+`)
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

const processMap: Map<string, Function> = new Map()

export function wrapExec(callback: Function): Function {
  return function(filePath: string, parameters: Array<string>, options: Object) {
    let killed = false
    const spawned = callback(filePath, parameters, Object.assign({ timeout: 10000 }, options))
    let mirror = spawned

    if (options.uniqueKey) {
      if (typeof options.uniqueKey !== 'string') throw new Error('options.uniqueKey must be a string')

      const oldValue = processMap.get(options.uniqueKey)
      if (oldValue) {
        oldValue()
      }
      processMap.set(options.uniqueKey, function() {
        killed = true
        spawned.kill()
      })
      mirror = mirror.then(function(value) {
        if (killed) return null
        return value
      }, function(error) {
        if (killed) return null
        throw error
      })
    }

    return mirror.catch(function(error) {
      if (error.code === 'ENOENT') {
        const newError = new Error(`Failed to spawn command \`${error.path}\`. Make sure \`${error.path}\` is installed and on your PATH`)
        // $FlowIgnore: Custom property
        newError.code = 'ENOENT'
        throw newError
      }
      throw error
    })
  }
}
