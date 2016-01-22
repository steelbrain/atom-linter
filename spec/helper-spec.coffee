fs = require 'fs'
path = require 'path'
helpers = require '../lib/helpers'
testFile = __dirname + '/fixtures/test.txt'
testContents = fs.readFileSync(testFile).toString()
describe 'linter helpers', ->
  describe '::exec*', ->
    it 'cries when no argument is passed', ->
      expect( -> helpers.exec()).toThrow()
      expect( -> helpers.execNode()).toThrow()
    it 'works', ->
      waitsForPromise ->
        helpers.execNode("#{__dirname}/fixtures/something.js").then (data) ->
          expect(data).toBe('STDOUT')
      waitsForPromise ->
        helpers.exec('cat', [testFile]).then (text) ->
          expect(text).toBe(testContents)
    it 'lets you choose streams', ->
      waitsForPromise ->
        helpers.execNode("#{__dirname}/fixtures/stderr.js", [], {stream: 'stderr'}).then (data) ->
          expect(data).toBe('STDERR')
      waitsForPromise ->
        helpers.exec('cat', [testFile], stream: 'stderr').then (text) ->
          expect(text).toBe('')
      waitsForPromise ->
        helpers.execNode("#{__dirname}/fixtures/both.js", [], {stream: 'both'}).then (data) ->
          expect(data.stdout).toBe('STDOUT')
          expect(data.stderr).toBe('STDERR')
    it 'accepts stdin', ->
      waitsForPromise ->
        helpers.execNode(
          "#{__dirname}/fixtures/something.js",
          ['input'],
          {stream: 'stdout', stdin: 'Wow'}
        ).then (data) ->
          expect(data).toBe('STDOUTWow')
      waitsForPromise ->
        helpers.exec('cat', [], stream: 'stdout', stdin: testContents).then (text) ->
          expect(text).toBe(testContents)
    it "throws if stderr is written to but wasn't expected", ->
      waitsForPromise ->
        helpers.execNode("#{__dirname}/fixtures/stderr.js", []).catch (error) ->
          expect(error.message).toBe('STDERR')
      waitsForPromise ->
        helpers.exec("#{__dirname}/fixtures/stderr.sh", []).catch (error) ->
          expect(error.message).toBe("STDERR\n")
    it 'shows a nicer error for EACCESS', ->
      waitsForPromise ->
        helpers.exec(__dirname).catch (error) ->
          expect(error.message).toContain('not a directory')

    describe 'throwOnStdErr option', ->
      it 'throws unexpected error when set to true', ->
        gotError = false
        waitsForPromise ->
          helpers.exec("#{__dirname}/fixtures/stderr.sh", [], throwOnStdErr: true).catch( (error) ->
            gotError = true
            expect(error.message).toBe("STDERR\n")
          ).then ->
            expect(gotError).toBe(true)
      it 'suppresses unexpected errors when set to false', ->
        gotError = false
        waitsForPromise ->
          helpers.exec("#{__dirname}/fixtures/stderr.sh", [], throwOnStdErr: false).catch(->
            gotError = true
          ).then ->
            expect(gotError).toBe(false)

  describe '::rangeFromLineNumber', ->
    it 'cries when invalid textEditor is passed', ->
      expect ->
        helpers.rangeFromLineNumber()
      .toThrow()
    it 'returns a range pointing at file start if no or invalid line is provided', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor)).toEqual([[0, 0], [0, 1]])
          expect(helpers.rangeFromLineNumber(textEditor, -1)).toEqual([[0, 0], [0, 1]])
          expect(helpers.rangeFromLineNumber(textEditor, 'a')).toEqual([[0, 0], [0, 1]])
    it 'ignores an invalid starting column', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor, 1, -1)).toEqual([[1, 0], [1, 41]])
          expect(helpers.rangeFromLineNumber(textEditor, 1, 'a')).toEqual([[1, 0], [1, 41]])
    it 'returns a range (array) with some valid points', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          range = helpers.rangeFromLineNumber(textEditor, 1) # 0 indexed
          expect(range instanceof Array).toBe(true)
          expect(range[0] instanceof Array).toBe(true)
          expect(range[1] instanceof Array).toBe(true)
          expect(range[0][0]).toEqual(1)
          expect(range[0][1]).toEqual(0)
          expect(range[1][0]).toEqual(1)
          expect(range[1][1]).toEqual(41)
    it 'returns a range (array) with some valid points and provided colStart', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          range = helpers.rangeFromLineNumber(textEditor, 1, 4) # 0 indexed
          expect(range instanceof Array).toBe(true)
          expect(range[0] instanceof Array).toBe(true)
          expect(range[1] instanceof Array).toBe(true)
          expect(range[0][0]).toEqual(1)
          expect(range[0][1]).toEqual(4)
          expect(range[1][0]).toEqual(1)
          expect(range[1][1]).toEqual(41)
    it 'cries when colStart is greater than line length', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          expect ->
            helpers.rangeFromLineNumber(textEditor, 1, 50)
          .toThrow()
    it 'cries when lineNumber is greater than the maximum line', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/something.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          expect ->
            helpers.rangeFromLineNumber(textEditor, 8)
          .toThrow()
    it 'handles files with mixed intentation', ->
      waitsForPromise ->
        atom.workspace.open("#{__dirname}/fixtures/mixedIndent.js").then ->
          textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor, 0)).toEqual([[0, 0], [0, 3]])  # None
          expect(helpers.rangeFromLineNumber(textEditor, 1)).toEqual([[1, 2], [1, 5]])  # Spaces
          expect(helpers.rangeFromLineNumber(textEditor, 2)).toEqual([[2, 1], [2, 4]])  # Tabs
          expect(helpers.rangeFromLineNumber(textEditor, 3)).toEqual([[3, 2], [3, 5]])  # Mixed

  describe '::parse', ->
    it 'cries when no argument is passed', ->
      expect ->
        helpers.parse()
      .toThrow()
    it "cries when data isn't string", ->
      expect ->
        helpers.parse([], '')
      .toThrow()
    it "works", ->
      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = 'TYPE:type message:message'
      output = [(
        type: 'type'
        text: 'message'
        filePath: null
        range: [[0, 0], [0, 0]]
      )]
      results = helpers.parse(input, regex, {flags: "i"})
      expect(results).toEqual(output)

      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = 'TYPE:type message:message'
      output = [(
        type: 'type'
        text: 'message'
        filePath: null
        range: [[0, 0], [0, 0]]
      )]
      results = helpers.parse(input, regex, {flags: "gi"})
      expect(results).toEqual(output)

  describe '::find', ->
    it 'cries when no argument is passed', ->
      expect ->
        helpers.find()
      .toThrow()
    it 'works', ->
      expect(helpers.find(__dirname, 'package.json')).toBe(fs.realpathSync("#{__dirname}/../package.json"))
      expect(helpers.findCached(__dirname, 'package.json')).toBe(fs.realpathSync("#{__dirname}/../package.json"))
    it 'returns null if no file is found', ->
      expect(helpers.find('/a/path/that/does/not/exist', '.gitignore')).toBe(null)
      expect(helpers.findCached('/a/path/that/does/not/exist', '.gitignore')).toBe(null)

  describe '::findAsync', ->
    it 'cries when no argument is passed', ->
      expect ->
        helpers.findAsync()
      .toThrow()
    it 'works', ->
      waitsForPromise ->
        helpers.findAsync(__dirname, 'package.json').then (path) ->
          expect(path).toBe(fs.realpathSync("#{__dirname}/../package.json"))
      waitsForPromise ->
        helpers.findCachedAsync(__dirname, 'package.json').then (path) ->
          expect(path).toBe(fs.realpathSync("#{__dirname}/../package.json"))
    it 'returns null if no file is found', ->
      waitsForPromise ->
        helpers.findCachedAsync(__dirname, '.ucompilerrc').then (path) ->
          expect(path).toBe(null)
      waitsForPromise ->
        helpers.findAsync(__dirname, '.ucompilerrc').then (path) ->
          expect(path).toBe(null)

  describe '::exec options', ->
    it 'honors cwd option', ->
      waitsForPromise ->
        testDir = "#{__dirname}/fixtures"
        helpers.exec( 'pwd', [], {cwd: testDir} ).then (result) ->
          expect(result.trim()).toEqual(testDir)

  describe '::tempFile', ->
    it 'cries when arguments are invalid', ->
      expect ->
        helpers.tempFile()
      .toThrow()
      expect ->
        helpers.tempFile(null, null, null)
      .toThrow()
      expect ->
        helpers.tempFile('', null, null)
      .toThrow()
      expect ->
        helpers.tempFile('', '', null)
      .toThrow()
      expect ->
        helpers.tempFile('', '', '')
      .toThrow()
    it 'works and accepts a callback and returns a promise and its promise value is that returned by the callback', ->
      filePath = null
      waitsForPromise ->
        helpers.tempFile('somefile.js', 'Hey There', (filepath) ->
          filePath = filepath
          expect(filePath.indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filePath)).toBe('somefile.js')
          expect(fs.existsSync(filePath)).toBe(true)
          expect(fs.readFileSync(filePath).toString()).toBe('Hey There')
          return 1
        ).then (result) ->
          expect(result).toBe(1)

  describe '::tempFiles', ->
    it 'cries when arguments are invalid', ->
      expect ->
        helpers.tempFiles()
      .toThrow()
      expect ->
        helpers.tempFiles(null, null)
      .toThrow()
      expect ->
        helpers.tempFiles('', null)
      .toThrow()
      expect ->
        helpers.tempFiles('', '')
      .toThrow()
      expect ->
        helpers.tempFiles(null, '')
      .toThrow()
      expect ->
        helpers.tempFiles([], '')
      .toThrow()
      expect ->
        helpers.tempFiles([], null)
      .toThrow()
    it 'works and accepts a callback and returns a promise and its promise value is that returned by the callback', ->
      filePaths = null
      waitsForPromise ->
        helpers.tempFiles(
          [
            {
              'name': 'foo.js',
              'contents': 'Foo!'
            },
            {
              'name': 'bar.js',
              'contents': 'Bar!'
            }
          ], (filepaths) ->
            filePaths = filepaths
            expect(filePaths[0].indexOf('atom-linter_')).not.toBe(-1)
            expect(path.basename(filePaths[0])).toBe('foo.js')
            expect(fs.existsSync(filePaths[0])).toBe(true)
            expect(fs.readFileSync(filePaths[0]).toString()).toBe('Foo!')

            expect(filePaths[1].indexOf('atom-linter_')).not.toBe(-1)
            expect(path.basename(filePaths[1])).toBe('bar.js')
            expect(fs.existsSync(filePaths[1])).toBe(true)
            expect(fs.readFileSync(filePaths[1]).toString()).toBe('Bar!')
            return filePaths
          ).then (result) ->
            expect(result.length).toBe(2)
