'use babel'

import {BufferedProcess, BufferedNodeProcess} from 'atom'
import Path from 'path'
import FS from 'fs'
import TMP from 'tmp'

let XRegExp = null
const XCache = new Map()
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

export function exec(command, args, options) {
  if (!arguments.length) {
    throw new Error('Nothing to execute')
  }
  return _exec(command, args, options, false)
}

export function execNode(command, args, options) {
  if (!arguments.length) {
    throw new Error('Nothing to execute')
  }
  return _exec(command, args, options, true)
}
