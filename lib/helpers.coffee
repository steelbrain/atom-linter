child_process = require 'child_process'
path = require 'path'
xcache = new Map
module.exports = Helpers =
  # Based on an API demoed out in:
  #   https://gist.github.com/steelbrain/43d9c38208bf9f2964ab

  exec: (command, args = [], options = {stream: 'stdout'}) ->
    throw new Error "Nothing to execute." if not arguments.length
    return new Promise (resolve, reject) ->
      process = child_process.spawn(command, args, options)
      options.stream = 'stdout' if not options.stream
      data = []
      process.stdout.on 'data', (d) -> data.push(d.toString()) if options.stream == 'stdout'
      process.stderr.on 'data', (d) -> data.push(d.toString()) if options.stream == 'stderr'
      process.stdin.write(options.stdin.toString()) if options.stdin
      process.on 'error', (err) ->
        reject(err)
      process.on 'close', ->
        resolve(data)

  # This should only be used if the linter is only working with files in their
  #   base directory. Else wise they should use `Helpers#exec`.
  execFilePath: (command, args = [], filePath, options = {}) ->
    throw new Error "Nothing to execute." if not arguments.length
    throw new Error "No File Path to work with." if not filePath
    return new Promise (resolve, reject) ->
      options.cwd = path.dirname(filePath) if not options.cwd
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
    new Promise (resolve) ->
      toReturn = []
      if xcache.has(rawRegex)
        regex = xcache.get(rawRegex)
      else
        xcache.set(rawRegex, regex = XRegExp(rawRegex))
      for line in data
        match = XRegExp.exec(line, regex)
        if match
          options.baseReduction = 1 if not options.baseReduction
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
      resolve(toReturn)
