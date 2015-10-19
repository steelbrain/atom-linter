{BufferedProcess, BufferedNodeProcess, TextEditor} = require('atom')
path = require 'path'
fs = require 'fs'
path = require 'path'
tmp = require('tmp')

xcache = new Map
XRegExp = null

module.exports = Helpers =
  # Based on an API demoed out in:
  #   https://gist.github.com/steelbrain/43d9c38208bf9f2964ab

  exec: (command, args = [], options = {}) ->
    throw new Error "Nothing to execute." unless arguments.length
    return @_exec(command, args, options, false)

  execNode: (filePath, args = [], options = {}) ->
    throw new Error "Nothing to execute." unless arguments.length
    return @_exec(filePath, args, options, true)

  _exec: (command, args = [], options = {}, isNodeExecutable = false) ->
    options.stream ?= 'stdout'
    options.throwOnStdErr ?= true
    return new Promise (resolve, reject) ->
      data = stdout: [], stderr: []
      stdout = (output) -> data.stdout.push(output.toString())
      stderr = (output) -> data.stderr.push(output.toString())
      exit = ->
        if options.stream is 'stdout'
          if data.stderr.length and options.throwOnStdErr
            reject(new Error(data.stderr.join('')))
          else
            resolve(data.stdout.join(''))
        else if options.stream is 'both'
          resolve(stdout: data.stdout.join(''), stderr: data.stderr.join(''))
        else
          resolve(data.stderr.join(''))
      if isNodeExecutable
        options.env ?= {}
        for prop, value of process.env
          options.env[prop] = value unless prop is 'OS'
        spawnedProcess = new BufferedNodeProcess({command, args, options, stdout, stderr, exit})
      else
        spawnedProcess = new BufferedProcess({command, args, options, stdout, stderr, exit})
      spawnedProcess.onWillThrowError(({error, handle}) =>
        return reject(error) if error and error.code is 'ENOENT'
        handle()
        if error.code is 'EACCES'
          error = new Error("Failed to spawn command `#{command}`. Make sure it's a file, not a directory and it's executable.")
          error.name = 'BufferedProcessError'
        reject(error)
      )
      if options.stdin
        spawnedProcess.process.stdin.write(options.stdin.toString())
        spawnedProcess.process.stdin.end() # We have to end it or the programs will keep waiting forever

  rangeFromLineNumber: (textEditor, lineNumber, colStart) ->
    throw new Error('Provided text editor is invalid') unless textEditor instanceof TextEditor
    throw new Error('Invalid lineNumber provided') if typeof lineNumber is 'undefined'
    unless typeof colStart is 'number'
      colStart = (textEditor.indentationForBufferRow(lineNumber) * textEditor.getTabLength())
    return [
      [lineNumber, colStart],
      [lineNumber, textEditor.getBuffer().lineLengthForRow(lineNumber)]
    ]

  # Due to what we are attempting to do, the only viable solution right now is
  #   XRegExp.
  #
  # Follows the following format taken from 0.x.y API.
  #
  # file: the file where the issue Exists
  # type: the type of issue occuring here
  # message: the message to show in the linter views (required)
  # line: the line number on which to mark error (required if not lineStart)
  # lineStart: the line number to start the error mark (optional)
  # lineEnd: the line number on end the error mark (optional)
  # col: the column on which to mark, will utilize syntax scope to higlight the
  #      closest matching syntax element based on your code syntax (optional)
  # colStart: column to on which to start a higlight (optional)
  # colEnd: column to end highlight (optional)
  # We place priority on `lineStart` and `lineEnd` over `line.`
  # We place priority on `colStart` and `colEnd` over `col.`
  parse: (data, rawRegex, options = {}) ->
    throw new Error "Nothing to parse" unless arguments.length
    XRegExp ?= require('xregexp').XRegExp
    options.baseReduction ?= 1
    options.flags ?= ""
    toReturn = []
    if xcache.has(rawRegex)
      regex = xcache.get(rawRegex)
    else
      xcache.set(rawRegex, regex = XRegExp(rawRegex, options.flags))
    throw new Error("Input must be a string") unless typeof data is 'string'
    for line in data.split(/\r?\n/)
      match = XRegExp.exec(line, regex)
      if match
        options.baseReduction = 1 unless options.baseReduction
        lineStart = 0
        lineStart = match.line - options.baseReduction if match.line
        lineStart = match.lineStart - options.baseReduction if match.lineStart
        colStart = 0
        colStart = match.col - options.baseReduction if match.col
        colStart = match.colStart - options.baseReduction if match.colStart
        lineEnd = 0
        lineEnd = match.line - options.baseReduction if match.line
        lineEnd = match.lineEnd - options.baseReduction if match.lineEnd
        colEnd = 0
        colEnd = match.col - options.baseReduction if match.col
        colEnd = match.colEnd - options.baseReduction if match.colEnd
        filePath = match.file
        filePath = options.filePath if options.filePath
        toReturn.push(
          type: match.type,
          text: match.message,
          filePath: filePath,
          range: [[lineStart, colStart], [lineEnd, colEnd]]
        )
    return toReturn
  findFile: (startDir, names) ->
    throw new Error "Specify a filename to find" unless arguments.length
    unless names instanceof Array
      names = [names]
    startDir = startDir.split(path.sep)
    while startDir.length && startDir.join(path.sep)
      currentDir = startDir.join(path.sep)
      for name in names
        filePath = path.join(currentDir, name)
        try
          fs.accessSync(filePath, fs.R_OK)
          return filePath
      startDir.pop()
    return null
  tempFile: (fileName, fileContents, callback) ->
    throw new Error('Invalid fileName provided') unless typeof fileName is 'string'
    throw new Error('Invalid fileContent provided') unless typeof fileContents is 'string'
    throw new Error('Invalid Callback provided') unless typeof callback is 'function'

    return new Promise (resolve, reject) ->
      tmp.dir {prefix: 'atom-linter_'}, (err, dirPath, cleanupCallback) ->
        return reject(err) if err
        filePath = path.join(dirPath, fileName)
        fs.writeFile filePath, fileContents, (err) ->
          if err
            cleanupCallback()
            return reject(err)
          (
            new Promise (resolve) ->
              resolve(callback(filePath))
          ).then((result) ->
            fs.unlink(filePath, ->
              fs.rmdir(dirPath)
            )
            return result
          ).then(resolve, reject)
