{BufferedProcess} = require 'atom'
Path = require 'path'
FS = require 'fs'

class Helpers
  @findFile: (directory, fileName)->
    climb = directory.split(Path.sep)
    while climb.length
      target = Path.join(climb.join(Path.sep), fileName)
      if FS.existsSync(target)
        return target
      climb.pop()
  @exec: (command, cwd, args)->
    executionTime = 5000
    return new Promise (resolve, reject) ->
      toReturn = {stdout: [], stderr: []}
      timeout = null
      spawnedProcess = new BufferedProcess(
        command: command
        args: args
        options: {cwd}
        stdout: (data) -> toReturn.stdout.push(data)
        stderr: (data) -> toReturn.stderr.push(data)
        exit: ->
          clearTimeout(timeout)
          resolve({stdout: toReturn.stdout.join(''), stderr: toReturn.stderr.join('')})
      )
      timeout = setTimeout ->
        spawnedProcess.kill()
        atom.notifications.addError(
          "command `#{command}` timed out after #{executionTime} ms"
        )
        reject()
      , executionTime

module.exports = Helpers
