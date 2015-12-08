'use babel'

import {BufferedProcess, BufferedNodeProcess} from 'atom'
import Path from 'path'
import FS from 'fs'
import TMP from 'tmp'

let XRegExp = null
const EventsCache = new WeakMap()

// TODO: Remove this when electron upgrades node
const assign = Object.assign || function(target, source) {
    for (const key in source) {
      target[key] = source[key]
    }
    return target
  }

function _exec(command, args, opts, isNode) {
  const options = assign({
    stream: 'stdout',
    throwOnStdErr: true
  }, opts)

  if (isNode) {
    const env = assign({}, process.env)
    delete env.OS
    assign(options, {env})
  }

  return new Promise(function(resolve, reject) {
    const data = {stdout: [], stderr: []}
    const parameters = {
      command,
      args,
      options,
      stdout: function(chunk) {
        data.stdout.push(chunk)
      },
      stderr: function(chunk) {
        data.stderr.push(chunk)
      },
      exit: function() {
        if (options.stream === 'stdout') {
          if (data.stderr.length && options.throwOnStdErr) {
            reject(new Error(data.stderr.join('')))
          } else {
            resolve(data.stdout.join(''))
          }
        } else if (options.stream === 'stderr') {
          resolve(data.stderr.join(''))
        } else {
          resolve({stdout: data.stdout.join(''), stderr: data.stderr.join('')})
        }
      }
    }
    const spawnedProcess = isNode ?
      new BufferedNodeProcess(parameters) :
      new BufferedProcess(parameters)

    spawnedProcess.onWillThrowError(function({error, handle}) {
      if (error.code !== 'ENOENT') {
        handle()
      }
      if (error.code === 'EACCES') {
        const newError = new Error(`Failed to spawn command '${command}'. Make sure it's a file, not a directory and it's executable.`)
        newError.name = 'BufferedProcessError'
        reject(newError)
      }
      reject(error)
    })

    if (options.stdin) {
      try {
        spawnedProcess.process.stdin.write(options.stdin.toString())
        spawnedProcess.process.stdin.end()
      } catch (_) {}
    }
  })
}

function validate_exec(command, args, options) {
  if (typeof command !== 'string') {
    throw new Error('Invalid or no `command` provided')
  } else if (!(args instanceof Array)) {
    throw new Error('Invalid or no `args` provided')
  } else if (typeof options !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }
}
function validate_find(directory, name) {
  if (typeof directory !== 'string') {
    throw new Error('Invalid or no `directory` provided')
  } else if (typeof name !== 'string' && !(name instanceof Array)) {
    throw new Error('Invalid or no `name` provided')
  }
}

function exec(command, args = [], options = {}) {
  validate_exec(command, args, options)
  return _exec(command, args, options, false)
}

function execNode(command, args = [], options = {}) {
  validate_exec(command, args, options)
  return _exec(command, args, options, true)
}

function rangeFromLineNumber(textEditor, lineNumber, colStart) {
  if (typeof textEditor.getText !== 'function') {
    throw new Error('Invalid textEditor provided')
  }

  if (typeof lineNumber !== 'number' || lineNumber !== lineNumber || lineNumber < 0) {
    return [[0, 0], [0, 1]]
  }

  const buffer = textEditor.getBuffer()
  const lineMax = buffer.getLineCount() - 1

  if (lineNumber > lineMax) {
    throw new Error(`Line number (${lineNumber}) greater than maximum line (${lineMax})`)
  }

  if (typeof colStart !== 'number' || colStart !== colStart || colStart < 0) {
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

function createElement(name) {
  if (typeof name !== 'string') {
    throw new Error('Invalid or no `Element name` provided')
  }

  const element = document.createElement(name)

  element.addEventListener = function(name, callback) {
    EventsCache.get(element).push({name, callback})
    Element.prototype.addEventListener.call(this, name, callback)
  }
  element.cloneNode = function(deep) {
    const newElement = Element.prototype.cloneNode.call(this, deep)
    EventsCache.get(element).forEach(function({name, callback}) {
      newElement.addEventListener(name, callback)
    })
    return newElement
  }

  EventsCache.set(element, [])
  return element
}

function findAsync(directory, name) {
  validate_find(directory, name)
  const names = name instanceof Array ? name : [name]
  const chunks = directory.split(Path.sep)
  let promise = Promise.resolve(null)

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep)
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/')
    }
    promise = promise.then(function(filePath) {
      if (filePath !== null) {
        return filePath
      }
      return names.reduce(function(promise, name) {
        const currentFile = Path.join(currentDir, name)
        return promise.then(function(filePath) {
          if (filePath !== null) {
            return filePath
          }
          return new Promise(function(resolve) {
            FS.access(currentFile, FS.R_OK, function(error) {
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

function find(directory, name) {
  validate_find(directory, name)
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
      } catch (_) {}
    }
    chunks.pop()
  }

  return null
}

function tempFile(fileName, fileContents, callback) {
  if (typeof fileName !== 'string') {
    throw new Error('Invalid or no `fileName` provided')
  } else if (typeof fileContents !== 'string') {
    throw new Error('Invalid or no `fileContents` provided')
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided')
  }

  return new Promise(function(resolve, reject) {
    TMP.dir({
      prefix: 'atom-linter_'
    }, function (error, directory, directoryCleanup) {
      if (error) {
        return reject(error)
      }
      const filePath = Path.join(directory, fileName)
      FS.writeFile(filePath, fileContents, function(error) {
        if (error) {
          directoryCleanup()
          return reject(error)
        }
        function fileCleanup() {
          FS.unlink(filePath, function() {
            directoryCleanup()
          })
        }
        new Promise(function(resolve) {
          resolve(callback(filePath))
        }).then(function(result) {
          fileCleanup()
          return result
        }, function(result) {
          fileCleanup()
          throw result
        }).then(resolve, reject)
      })
    })
  })
}

function parse(data, regex, opts = {}) {
  if (typeof data !== 'string') {
    throw new Error('Invalid or no `data` provided')
  } else if (typeof regex !== 'string') {
    throw new Error('Invalid or no `regex` provided')
  } else if (typeof opts !== 'object') {
    throw new Error('Invalid or no `options` provided')
  }

  if (XRegExp === null) {
    XRegExp = require('xregexp').XRegExp
  }

  const messages = []
  const options = assign({
    flags: 'g'
  }, opts)
  const lines = data.split('\n')
  const xregex = XRegExp(regex, options.flags)

  lines.forEach(function(line) {
    const match = XRegExp.exec(line, xregex)

    if (match === null) {
      return
    }

    const type = match.type
    const text = match.message
    const file = match.file || options.filePath || null

    const lineStart = match.lineStart || match.line || 0
    const colStart = match.colStart || match.col || 0
    const lineEnd = match.lineEnd || match.line || 0
    const colEnd = match.colEnd || match.col || 0

    messages.push({
      type: type,
      text: text,
      filePath: file,
      range: [
        [lineStart > 0 ? lineStart - 1 : 0, colStart > 0 ? colStart - 1 : 0],
        [lineEnd > 0 ? lineEnd - 1 : 0, colEnd > 0 ? colEnd - 1 : 0],
      ]
    })
  })

  return messages
}

module.exports = {
  exec, execNode, rangeFromLineNumber,
  find, findAsync, createElement,
  parse, tempFile,
  findFile: find, fineFileAsync: findAsync
}
