describe 'linter helpers', ->
  helpers = require '../lib/helpers'
  describe '::exec', ->
    it 'cries when no argument is passed', ->
      gotError = false
      try
        helpers.exec()
      catch erro then gotError = true
      expect(gotError).toBe(true)