fs = require 'fs'
helpers = require '../lib/helpers'
testFile = __dirname + '/fixtures/test.txt'
testContents = fs.readFileSync(testFile).toString()
describe 'linter helpers', ->
  describe '::exec', ->
    it 'cries when no argument is passed', ->
      gotError = false
      try
        helpers.exec()
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it 'works', ->
      waitsForPromise ->
        helpers.exec('cat', [testFile]).then (text) ->
          expect(text).toBe(testContents)
    it 'lets you choose streams', ->
      waitsForPromise ->
        helpers.exec('cat', [testFile], stream: 'stderr').then (text) ->
          expect(text).toBe('')
    it 'accepts stdin', ->
      waitsForPromise ->
        helpers.exec('cat', [], stream: 'stdout', stdin: testContents).then (text) ->
          expect(text).toBe(testContents)
  describe '::execFilePath', ->
    it 'cries when no argument is passed', ->
      gotError = false
      try
        helpers.execFilePath()
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it 'cries when no filepath is passed', ->
      gotError = false
      try
        helpers.execFilePath('cat', [])
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it 'works', ->
      waitsForPromise ->
        helpers.execFilePath('cat', [], testFile).then (text) ->
          expect(text).toBe(testContents)
  describe '::parse', ->
    it 'cries when no argument is passed', ->
      gotError = false
      try
        helpers.parse()
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it "works", ->
      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = ['type:type message:message']
      output = [(
        type: 'type'
        text: 'message'
        filePath: undefined
        range: [[0, 0], [0, 0]]
      )]
      results = helpers.parse(input, regex)
      expect(results).toEqual(output)
  describe '::findFile', ->
    it 'cries wen no argument is passed', ->
      gotError = false
      try
        helpers.parse()
      catch erro then gotError = true
      expect(gotError).toBe(true)
    it 'works', ->
      expect(helpers.findFile(__dirname, 'package.json')).toBe(fs.realpathSync(__dirname + '/../package.json'))