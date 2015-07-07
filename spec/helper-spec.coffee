describe 'linter helpers', ->
  helpers = require '../lib/helpers'
  fs = require 'fs'
  testFile = __dirname + '/fixtures/test.txt'
  describe '::exec', ->
    it 'cries when no argument is passed', ->
      gotError = false
      try
        helpers.exec()
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it 'works', ->
      waitsForPromise ->
        helpers.exec('cat', [testFile]).then (text)->
          expect(text).toBe(fs.readFileSync(testFile).toString())