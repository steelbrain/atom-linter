'use babel'

import * as fs from 'fs'
import * as path from 'path'
const helpers = require('../lib/helpers')

const bothFile = path.join(__dirname, 'fixtures', 'both.js')
const mixedIndentFile = path.join(__dirname, 'fixtures', 'mixedIndent.txt')
const somethingFile = path.join(__dirname, 'fixtures', 'something.js')
const stderrFile = path.join(__dirname, 'fixtures', 'stderr.js')
const stderrScript = path.join(__dirname, 'fixtures', 'stderr') +
  (process.platform !== 'win32' ? '.sh' : '.bat')
const testFile = path.join(__dirname, 'fixtures', 'test.txt')
const packageJsonPath = fs.realpathSync(`${__dirname}/../package.json`)

const testContents = fs.readFileSync(testFile).toString()

describe('linter helpers', () => {
  describe('::exec*', () => {
    // `cd` with no params prints the current dir on Windows
    const pwdCommand = process.platform !== 'win32' ? 'pwd' : 'cd'
    const catCommand = process.platform !== 'win32' ? 'cat' : 'type'

    it('cries when no argument is passed', () => {
      expect(() =>
        helpers.exec()
      ).toThrow()
      return expect(() =>
        helpers.execNode()
      ).toThrow()
    })

    it('works', () => {
      waitsForPromise(() =>
        helpers.execNode(somethingFile).then(data =>
          expect(data).toBe('STDOUT')
        )
      )
      return waitsForPromise(() =>
        helpers.exec(catCommand, [testFile]).then((text) =>
          expect(text).toBe(testContents)
        )
      )
    })

    it('lets you choose streams', () => {
      waitsForPromise(() =>
        helpers.execNode(stderrFile, [], { stream: 'stderr' }).then(data =>
          expect(data).toBe('STDERR')
        )
      )
      waitsForPromise(() =>
        helpers.exec(catCommand, [testFile], { stream: 'stderr' }).then(text =>
          expect(text).toBe('')
        )
      )
      return waitsForPromise(() =>
        helpers.execNode(bothFile, [], { stream: 'both' }).then(data => {
          expect(data.stdout).toBe('STDOUT')
          return expect(data.stderr).toBe('STDERR')
        })
      )
    })

    it('accepts stdin', () => {
      waitsForPromise(() =>
        helpers.execNode(somethingFile, ['input'], {
          stream: 'stdout',
          stdin: 'Wow'
        }).then(data =>
          expect(data).toBe('STDOUTWow')
        )
      )
    })

    it("throws if stderr is written to but wasn't expected", () => {
      waitsForPromise(() =>
        helpers.execNode(stderrFile, []).catch(error =>
          expect(error.message).toBe('STDERR')
        )
      )

      return waitsForPromise(() =>
        helpers.exec(stderrScript, []).catch(error =>
          expect(error.message.trim()).toBe('STDERR')
        )
      )
    })

    it('shows a nicer error for EACCESS', () =>
      waitsForPromise(() =>
        helpers.exec(__dirname).catch(error =>
          expect(error.message).toContain('not a directory')
        )
      )
    )

    describe('the throwOnStdErr option:', () => {
      it('throws unexpected error when set to true', () => {
        let gotError = false
        return waitsForPromise(() =>
          helpers.exec(stderrScript, [], {
            throwOnStdErr: true
          }).catch(error => {
            gotError = true
            return expect(error.message.trim()).toBe('STDERR')
          }).then(() =>
            expect(gotError).toBe(true)
          )
        )
      })

      return it('suppresses unexpected errors when set to false', () => {
        let gotError = false
        return waitsForPromise(() =>
          helpers.exec(stderrScript, [], {
            throwOnStdErr: false
          }).catch(() =>
            gotError = true
          ).then(() =>
            expect(gotError).toBe(false)
          )
        )
      })
    })

    return describe('the cwd option', () =>
      it('works', () =>
        waitsForPromise(() => {
          const testDir = path.join(__dirname, 'fixtures')
          return helpers.exec(pwdCommand, [], { cwd: testDir }).then(result =>
            expect(result.trim()).toEqual(testDir)
          )
        })
      )
    )
  })

  describe('::rangeFromLineNumber', () => {
    it('cries when invalid textEditor is passed', () =>
      expect(() =>
        helpers.rangeFromLineNumber()
      ).toThrow()
    )

    it('returns a range pointing at file start if no or invalid line is provided', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor)).toEqual([[0, 0], [0, 1]])
          expect(helpers.rangeFromLineNumber(textEditor, -1)).toEqual([[0, 0], [0, 1]])
          return expect(helpers.rangeFromLineNumber(textEditor, 'a')).toEqual([[0, 0], [0, 1]])
        })
      )
    )

    it('ignores an invalid starting column', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor, 7, -1)).toEqual([[7, 0], [7, 43]])
          return expect(helpers.rangeFromLineNumber(textEditor, 7, 'a')).toEqual([[7, 0], [7, 43]])
        })
      )
    )

    it('returns a range (array) with some valid points', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          const range = helpers.rangeFromLineNumber(textEditor, 7)
          expect(range instanceof Array).toBe(true)
          expect(range[0] instanceof Array).toBe(true)
          expect(range[1] instanceof Array).toBe(true)
          expect(range[0][0]).toEqual(7)
          expect(range[0][1]).toEqual(0)
          expect(range[1][0]).toEqual(7)
          return expect(range[1][1]).toEqual(43)
        })
      )
    )

    it('returns a range (array) with some valid points and provided colStart', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          const range = helpers.rangeFromLineNumber(textEditor, 7, 4)
          expect(range instanceof Array).toBe(true)
          expect(range[0] instanceof Array).toBe(true)
          expect(range[1] instanceof Array).toBe(true)
          expect(range[0][0]).toEqual(7)
          expect(range[0][1]).toEqual(4)
          expect(range[1][0]).toEqual(7)
          return expect(range[1][1]).toEqual(43)
        })
      )
    )

    it('cries when colStart is greater than line length', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          return expect(() =>
            helpers.rangeFromLineNumber(textEditor, 7, 50)
          ).toThrow()
        })
      )
    )

    it('cries when lineNumber is greater than the maximum line', () =>
      waitsForPromise(() =>
        atom.workspace.open(somethingFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          return expect(() =>
            helpers.rangeFromLineNumber(textEditor, 11)
          ).toThrow()
        })
      )
    )

    return it('handles files with mixed intentation', () =>
      waitsForPromise(() =>
        atom.workspace.open(mixedIndentFile).then(() => {
          const textEditor = atom.workspace.getActiveTextEditor()
          expect(helpers.rangeFromLineNumber(textEditor, 0)).toEqual([[0, 0], [0, 3]])
          expect(helpers.rangeFromLineNumber(textEditor, 1)).toEqual([[1, 2], [1, 5]])
          expect(helpers.rangeFromLineNumber(textEditor, 2)).toEqual([[2, 1], [2, 4]])
          return expect(helpers.rangeFromLineNumber(textEditor, 3)).toEqual([[3, 2], [3, 5]])
        })
      )
    )
  })

  describe('::parse', () => {
    it('cries when no argument is passed', () =>
      expect(() => helpers.parse()).toThrow()
    )

    it("cries when data isn't string", () =>
      expect(() => helpers.parse([], '')).toThrow()
    )

    return it('works', () => {
      let regex = 'type:(?<type>.+) message:(?<message>.+)'
      let input = 'TYPE:type message:message'
      let output = [
        {
          type: 'type',
          text: 'message',
          filePath: null,
          range: [[0, 0], [0, 0]]
        }
      ]
      let results = helpers.parse(input, regex, { flags: 'i' })
      expect(results).toEqual(output)

      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = 'TYPE:type message:message'
      output = [
        {
          type: 'type',
          text: 'message',
          filePath: null,
          range: [[0, 0], [0, 0]]
        }
      ]
      results = helpers.parse(input, regex, { flags: 'gi' })
      return expect(results).toEqual(output)
    })
  })

  describe('::find', () => {
    it('cries when no argument is passed', () =>
      expect(() => helpers.find()).toThrow()
    )

    it('works', () => {
      expect(helpers.find(__dirname, 'package.json')).
        toBe(packageJsonPath)
      return expect(helpers.findCached(__dirname, 'package.json')).
        toBe(packageJsonPath)
    })

    return it('returns null if no file is found', () => {
      expect(helpers.find('/a/path/that/does/not/exist', '.gitignore')).toBe(null)
      return expect(helpers.findCached('/a/path/that/does/not/exist', '.gitignore')).toBe(null)
    })
  })

  describe('::findAsync', () => {
    it('cries when no argument is passed', () =>
      expect(() => helpers.findAsync()).toThrow()
    )

    it('works', () => {
      waitsForPromise(() =>
        helpers.findAsync(__dirname, 'package.json').then(foundPath =>
          expect(foundPath).toBe(packageJsonPath)
        )
      )
      return waitsForPromise(() =>
        helpers.findCachedAsync(__dirname, 'package.json').then(foundPath =>
          expect(foundPath).toBe(packageJsonPath)
        )
      )
    })

    return it('returns null if no file is found', () => {
      waitsForPromise(() =>
        helpers.findCachedAsync(__dirname, '.ucompilerrc').then(foundPath =>
          expect(foundPath).toBe(null)
        )
      )
      return waitsForPromise(() =>
        helpers.findAsync(__dirname, '.ucompilerrc').then(foundPath =>
          expect(foundPath).toBe(null)
        )
      )
    })
  })

  describe('::tempFile', () => {
    it('cries when arguments are invalid', () => {
      expect(() => helpers.tempFile()).toThrow()
      expect(() => helpers.tempFile(null, null, null)).toThrow()
      expect(() => helpers.tempFile('', null, null)).toThrow()
      expect(() => helpers.tempFile('', '', null)).toThrow()
      return expect(() => helpers.tempFile('', '', '')).toThrow()
    })

    return it('works and accepts a callback and returns a promise and its promise' +
      ' value is that returned by the callback', () =>
      waitsForPromise(() =>
        helpers.tempFile('somefile.js', 'Hey There', filepath => {
          expect(filepath.indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepath)).toBe('somefile.js')
          expect(fs.existsSync(filepath)).toBe(true)
          expect(fs.readFileSync(filepath).toString()).toBe('Hey There')
          return 1
        }).then(result => expect(result).toBe(1))
      )
    )
  })

  return describe('::tempFiles', () => {
    it('cries when arguments are invalid', () => {
      expect(() => helpers.tempFiles()).toThrow()
      expect(() => helpers.tempFiles(null, null)).toThrow()
      expect(() => helpers.tempFiles('', null)).toThrow()
      expect(() => helpers.tempFiles('', '')).toThrow()
      expect(() => helpers.tempFiles(null, '')).toThrow()
      expect(() => helpers.tempFiles([], '')).toThrow()
      return expect(() => helpers.tempFiles([], null)).toThrow()
    })

    return it('works and accepts a callback and returns a promise and its promise ' +
      'value is that returned by the callback', () =>
      waitsForPromise(() =>
        helpers.tempFiles([
          { name: 'foo.js', contents: 'Foo!' },
          { name: 'bar.js', contents: 'Bar!' }
        ], filepaths => {
          expect(filepaths[0].indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepaths[0])).toBe('foo.js')
          expect(fs.existsSync(filepaths[0])).toBe(true)
          expect(fs.readFileSync(filepaths[0]).toString()).toBe('Foo!')
          expect(filepaths[1].indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepaths[1])).toBe('bar.js')
          expect(fs.existsSync(filepaths[1])).toBe(true)
          expect(fs.readFileSync(filepaths[1]).toString()).toBe('Bar!')
          return filepaths
        }).then(result => expect(result.length).toBe(2))
      )
    )
  })
})
