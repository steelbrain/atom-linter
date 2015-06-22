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

module.exports = Helpers
