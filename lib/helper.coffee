ChildProcess = require 'child_process'
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
  @exec: (command, cwd, stdin)->
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

module.exports = Helpers
