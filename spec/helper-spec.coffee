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
      .toThrow("Input must be a string")
    it "works", ->
      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = 'TYPE:type message:message'
      output = [(
        type: 'type'
        text: 'message'
        filePath: undefined
        range: [[0, 0], [0, 0]]
      )]
      results = helpers.parse(input, regex, {flags: "i"})
      expect(results).toEqual(output)

  describe '::findFile', ->
    it 'cries when no argument is passed', ->
      expect ->
        helpers.findFile()
      .toThrow()
    it 'works', ->
      expect(helpers.findFile(__dirname, 'package.json')).toBe(fs.realpathSync("#{__dirname}/../package.json"))
    it 'does not find files of the linter module', ->
      expect(helpers.findFile('/a/path/that/does/not/exist', '.gitignore')).toBe(null)

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

  describe '::createElement', ->
    it 'works', ->
      clicked = false
      clickListener = -> clicked = true

      el = helpers.createElement('div')
      el.innerHTML = 'Some HTML'
      expect(el.innerHTML).toBe('Some HTML')
      el.appendChild(document.createElement('div'))
      expect(el.children.length).toBe(1)

      el.addEventListener('click', clickListener)

      expect(clicked).toBe(false)
      el.dispatchEvent(new MouseEvent('click'))
      expect(clicked).toBe(true)

      clicked = false
      clonedEl = el.cloneNode(true)
      clonedEl.dispatchEvent(new MouseEvent('click'))
      expect(clicked).toBe(true)

      el.removeEventListener('click', clickListener)
      clicked = false
      clonedEl = el.cloneNode(true)
      clonedEl.dispatchEvent(new MouseEvent('click'))
      expect(clicked).toBe(false)
