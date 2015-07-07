child_process = require 'child_process'
path = require 'path'
fs = require 'fs'
path = require 'path'
xcache = new Map
XRegExp = null
module.exports = Helpers =
  # Based on an API demoed out in:
  #   https://gist.github.com/steelbrain/43d9c38208bf9f2964ab

  exec: (command, args = [], options = {}) ->
    options.stream ?= 'stdout'
    throw new Error "Nothing to execute." unless arguments.length
    return new Promise (resolve, reject) ->
      spawnedProcess = child_process.spawn(command, args, options)
      data = []
      if options.stream is 'stdout'
        spawnedProcess.stdout.on 'data', (d) -> data.push(d.toString())
      else if options.stream is 'stderr'
        spawnedProcess.stderr.on 'data', (d) -> data.push(d.toString())
      if options.stdin
        spawnedProcess.stdin.write(options.stdin.toString())
        spawnedProcess.stdin.end() # We have to end it or the programs will keep waiting forever
      spawnedProcess.on 'error', (err) ->
        reject(err)
      spawnedProcess.on 'close', ->
        resolve(data.join(''))

  # This should only be used if the linter is only working with files in their
  #   base directory. Else wise they should use `Helpers#exec`.
  execFilePath: (command, args = [], filePath, options = {}) ->
    throw new Error "Nothing to execute." unless arguments.length
    throw new Error "No File Path to work with." unless filePath
    return new Promise (resolve) ->
      options.cwd = path.dirname(filePath) unless options.cwd
      args.push(filePath)
      resolve(Helpers.exec(command, args, options))

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
  parse: (data, rawRegex, options = {baseReduction: 1}) ->
    throw new Error "Nothing to parse" unless arguments.length
    XRegExp ?= require('xregexp').XRegExp
    toReturn = []
    if xcache.has(rawRegex)
      regex = xcache.get(rawRegex)
    else
      xcache.set(rawRegex, regex = XRegExp(rawRegex))
    for line in data
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
    while startDir.length
      currentDir = startDir.join(path.sep)
      for name in names
        filePath = path.join(currentDir, name)
        try
          fs.accessSync(filePath, fs.R_OK)
          return filePath
      startDir.pop()
    return null