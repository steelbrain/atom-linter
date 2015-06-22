ChildProcess = require 'child_process'
Path = require 'path'
FS = require 'fs'
{XRegExp} = require 'xregexp'

class Helpers
  @findFile: (directory, fileName) ->
    climb = directory.split(Path.sep)
    while climb.length
      target = Path.join(climb.join(Path.sep), fileName)
      if FS.existsSync(target)
        return target
      climb.pop()
  @exec: (command, cwd, stdin) ->
    executionTime = 5000
    return new Promise (resolve, reject) ->
      timeout = null
      spawnedProcess = ChildProcess.exec "#{command.join(' ')}", {cwd}, (err, stdout, stderr)->
        clearTimeout(timeout)
        if err and (not stderr) and (not stdout)
          reject(err)
        else
          resolve({stdout, stderr})
      if stdin
        spawnedProcess.stdin.write(stdin)
        spawnedProcess.stdin.end()

      timeout = setTimeout ->
        spawnedProcess.kill()
        errText = "command `#{command}` timed out after #{executionTime} ms"
        atom.notifications.addError(
          errText
        )
        reject(new Error(errText))
      , executionTime
  @createMessages:(textEditor, Regex, RegexFlags, Buffer) ->
    Regex = XRegExp(Regex, RegexFlags)
    textBuffer = textEditor.getBuffer()
    filePath = textEditor.getPath()
    toReturn = []
    XRegExp.forEach Buffer, Regex, (match) ->
      message = {}
      if match.warning
        message.type = 'Warning'
      else if match.error or match.fail
        message.type = 'Error'

      if match.file
        message.filePath = match.file
      else if message.fileName
        message.filePath = match.fileName
      else
        message.filePath = filePath

      if match.line
        # It has only starting position
        startLine = match.line
        if match.col
        # It has start col
          startCol = match.col
        else
          indentLevel = textEditor.indentationForBufferRow(startLine - 1)
          startCol = (textEditor.getTabLength() * indentLevel)
        endCol = textBuffer.lineLengthForRow(startLine - 1)
        endLine = startLine
      else if match.startLine
        startLine = match.startLine
        startCol = match.startCol
        endLine = match.endLine
        endCol = match.endCol

      console.log startLine

      startLine = parseInt(startLine)
      startCol = parseInt(startCol)
      endLine = parseInt(endLine)
      endCol = parseInt(endCol)

      if startLine isnt startLine
        startLine = 1
      if startCol isnt startCol
        startCol = 1
      if endLine isnt endLine
        endLine = startLine
      if endCol isnt endCol
        endCol = startCol

      message.html = match.message || match.text
      message.range = [[startLine - 1, startCol - 1], [endLine - 1, endCol]]
      toReturn.push(message)
    toReturn

module.exports = Helpers
