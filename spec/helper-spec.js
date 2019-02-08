/* @flow */

import * as fs from 'fs'
import * as path from 'path'
import { execNode } from 'sb-exec'
import { it, wait } from 'jasmine-fix'
import { waitsForAsync, waitsForAsyncRejection } from './spec-helpers'
import * as helpersOfHelpers from '../src/helpers'
import * as helpers from '../src/index'

const mixedIndentFile = path.join(__dirname, 'fixtures', 'mixedIndent.txt')
const somethingFile = path.join(__dirname, 'fixtures', 'something.js')
const packageJsonPath = fs.realpathSync(`${__dirname}/../package.json`)
const wait2SecondsFile = path.join(__dirname, 'fixtures', 'wait-2-seconds.js')

describe('linter helpers', function () {
  describe('::generateRange', function () {
    it('cries when invalid textEditor is passed', () =>
      expect(() =>
        helpers.generateRange(),
      ).toThrow(),
    )

    it('returns a range pointing at file start if no or invalid line is provided', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(helpers.generateRange(textEditor)).toEqual([[0, 0], [0, 30]])
        expect(helpers.generateRange(textEditor, -1)).toEqual([[0, 0], [0, 30]])
        // $FlowIgnore: Purposely invalid input type
        expect(helpers.generateRange(textEditor, 'a')).toEqual([[0, 0], [0, 30]])
      }),
    )

    it('ignores an invalid starting column', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(helpers.generateRange(textEditor, 7, -1)).toEqual([[7, 0], [7, 43]])
        // $FlowIgnore: Purposely invalid input type
        expect(helpers.generateRange(textEditor, 7, 'a')).toEqual([[7, 0], [7, 43]])
      }),
    )

    it('returns a range (array) with some valid points', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        const range = helpers.generateRange(textEditor, 7)
        expect(range).toEqual([[7, 0], [7, 43]])
      }),
    )

    it('returns a range (array) with some valid points and provided colStart', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        const range = helpers.generateRange(textEditor, 7, 4)
        expect(range).toEqual([[7, 4], [7, 11]])
      }),
    )

    it('cries when colStart is greater than line length', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(() =>
          helpers.generateRange(textEditor, 7, 50),
        ).toThrow()
      }),
    )

    it('cries when lineNumber is greater than the maximum line', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(() =>
          helpers.generateRange(textEditor, 11),
        ).toThrow()
      }),
    )

    it('handles files with mixed intentation', () =>
      waitsForAsync(async function () {
        await atom.workspace.open(mixedIndentFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(helpers.generateRange(textEditor, 0)).toEqual([[0, 0], [0, 3]])
        expect(helpers.generateRange(textEditor, 1)).toEqual([[1, 2], [1, 5]])
        expect(helpers.generateRange(textEditor, 2)).toEqual([[2, 1], [2, 4]])
        expect(helpers.generateRange(textEditor, 3)).toEqual([[3, 2], [3, 5]])
      }),
    )

    it('returns a smart colEnd when starting position is provided', function() {
      waitsForAsync(async function() {
        await atom.workspace.open(mixedIndentFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(helpers.generateRange(textEditor, 0, 0)).toEqual([[0, 0], [0, 3]])
        expect(helpers.generateRange(textEditor, 1, 0)).toEqual([[1, 0], [1, 5]])
        expect(helpers.generateRange(textEditor, 2, 0)).toEqual([[2, 0], [2, 4]])
        expect(helpers.generateRange(textEditor, 3, 0)).toEqual([[3, 0], [3, 5]])
      })
    })
  })

  describe('::parse', function () {
    function parse(a: any = undefined, b: any = undefined, c: any = undefined) {
      return helpers.parse(a, b, c)
    }

    it('cries when no argument is passed', () =>
      expect(() => parse()).toThrow(),
    )

    it("cries when data isn't string", () =>
      expect(() => parse([], '')).toThrow(),
    )

    it('works', function () {
      let regex = 'type:(?<type>.+) message:(?<message>.+)'
      let input = 'TYPE:type message:message'
      let output = [
        {
          severity: 'type',
          excerpt: 'message',
          location: {
            file: null,
            position: [[0, 0], [0, 0]],
          },
        },
      ]
      let results = helpers.parse(input, regex, { flags: 'i' })
      expect(results).toEqual(output)

      regex = 'type:(?<type>.+) message:(?<message>.+)'
      input = 'TYPE:type message:message'
      output = [
        {
          severity: 'type',
          excerpt: 'message',
          location: {
            file: null,
            position: [[0, 0], [0, 0]],
          },
        },
      ]
      results = helpers.parse(input, regex, { flags: 'gi' })
      expect(results).toEqual(output)
    })
  })

  describe('::find', function () {
    function find(dir: any, names: any) {
      return helpers.find(dir, names)
    }

    it('cries when no argument is passed', () =>
      expect(() => find()).toThrow(),
    )

    it('works', function () {
      expect(helpers.find(__dirname, 'package.json'))
        .toBe(packageJsonPath)
      expect(helpers.findCached(__dirname, 'package.json'))
        .toBe(packageJsonPath)
    })

    it('returns null if no file is found', function () {
      expect(helpers.find('/a/path/that/does/not/exist', '.gitignore')).toBe(null)
      expect(helpers.findCached('/a/path/that/does/not/exist', '.gitignore')).toBe(null)
    })
  })

  describe('::findAsync', function () {
    function findAsync(dir: any, names: any) {
      return helpers.findAsync(dir, names)
    }

    it('cries when no argument is passed', () =>
      waitsForAsyncRejection(async function () {
        return findAsync()
      }),
    )

    it('works', function () {
      waitsForAsync(async function () {
        return helpers.findAsync(__dirname, 'package.json')
      }, packageJsonPath)
      waitsForAsync(async function () {
        return helpers.findCachedAsync(__dirname, 'package.json')
      }, packageJsonPath)
    })

    it('returns null if no file is found', function () {
      waitsForAsync(async function () {
        return helpers.findAsync(__dirname, '.ucompilerrc')
      }, null)
      waitsForAsync(async function () {
        return helpers.findCachedAsync(__dirname, '.ucompilerrc')
      }, null)
    })
  })

  describe('::tempFile', function () {
    function tempFile(a: any = undefined, b: any = undefined, c: any = undefined) {
      return helpers.tempFile(a, b, c)
    }

    it('cries when arguments are invalid', function () {
      expect(() => tempFile()).toThrow()
      expect(() => tempFile(null, null, null)).toThrow()
      expect(() => tempFile('', null, null)).toThrow()
      expect(() => tempFile('', '', null)).toThrow()
      expect(() => tempFile('', '', '')).toThrow()
    })

    it('works and accepts a callback and returns a promise and its promise' +
      ' value is that returned by the callback', () =>
      waitsForAsync(async () =>
        helpers.tempFile('somefile.js', 'Hey There', (filepath) => {
          expect(filepath.indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepath)).toBe('somefile.js')
          expect(fs.existsSync(filepath)).toBe(true)
          expect(fs.readFileSync(filepath).toString()).toBe('Hey There')
          return Promise.resolve(1)
        })
      , 1),
    )
  })

  describe('::tempFiles', function () {
    function tempFiles(a: any = undefined, b: any = undefined) {
      return helpers.tempFiles(a, b)
    }

    it('cries when arguments are invalid', function () {
      waitsForAsyncRejection(async function () {
        await tempFiles()
      })
      waitsForAsyncRejection(async function () {
        await tempFiles(null, null)
      })
      waitsForAsyncRejection(async function () {
        await tempFiles('', null)
      })
      waitsForAsyncRejection(async function () {
        await tempFiles('', '')
      })
      waitsForAsyncRejection(async function () {
        await tempFiles(null, '')
      })
      waitsForAsyncRejection(async function () {
        await tempFiles([], '')
      })
      waitsForAsyncRejection(async function () {
        await tempFiles([], null)
      })
      waitsForAsync(async function () {
        return helpers.tempFiles([], function (files) {
          expect(files).toEqual([])
          return Promise.resolve(50)
        })
      }, 50)
    })

    it('works and accepts a callback and returns a promise and its promise ' +
      'value is that returned by the callback', () =>
      waitsForAsync(async () =>
        helpers.tempFiles([
          { name: 'foo.js', contents: 'Foo!' },
          { name: 'bar.js', contents: 'Bar!' },
        ], (filepaths) => {
          expect(filepaths[0].indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepaths[0])).toBe('foo.js')
          expect(fs.existsSync(filepaths[0])).toBe(true)
          expect(fs.readFileSync(filepaths[0]).toString()).toBe('Foo!')
          expect(filepaths[1].indexOf('atom-linter_')).not.toBe(-1)
          expect(path.basename(filepaths[1])).toBe('bar.js')
          expect(fs.existsSync(filepaths[1])).toBe(true)
          expect(fs.readFileSync(filepaths[1]).toString()).toBe('Bar!')
          return Promise.resolve(filepaths)
        }).then(result => expect(result.length).toBe(2)),
      ),
    )
  })
  describe('validateEditor', function () {
    it('works if there\'s atom.workspace.isTextEditor', function () {
      waitsForAsync(async function () {
        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(function () {
          helpersOfHelpers.validateEditor(textEditor)
        }).not.toThrow()
        expect(function () {
          helpersOfHelpers.validateEditor(null)
        }).toThrow()
        expect(function () {
          helpersOfHelpers.validateEditor(false)
        }).toThrow()
      })
    })
    it('works if there isnt atom.workspace.isTextEditor', function () {
      waitsForAsync(async function () {
        const _ = atom.workspace.isTextEditor
        atom.workspace.isTextEditor = null

        await atom.workspace.open(somethingFile)
        const textEditor = atom.workspace.getActiveTextEditor()
        expect(function () {
          helpersOfHelpers.validateEditor(textEditor)
        }).not.toThrow()
        expect(function () {
          helpersOfHelpers.validateEditor(null)
        }).toThrow()
        expect(function () {
          helpersOfHelpers.validateEditor(false)
        }).toThrow()

        atom.workspace.isTextEditor = _
      })
    })
  })
  describe('wrapExec', function() {
    it('resolves properly', async function() {
      const uniqueObj = {}
      const [a, b, c] = [{}, {}, {}]
      const wrapped = helpersOfHelpers.wrapExec(async function(givenA, givenB, givenC) {
        await wait(10)
        expect(givenA).toBe(a)
        expect(givenB).toBe(b)
        expect(givenC).toEqual({ timeout: 10000 })
        return uniqueObj
      })
      expect(await wrapped(a, b, c)).toBe(uniqueObj)
    })
    it('rejects non-ENOENT errors properly', async function() {
      const wrapped = helpersOfHelpers.wrapExec(async function() {
        await wait(10)
        const error = new Error('Something')
        // $FlowIgnore: Custom property
        error.code = 'EAGAIN'
        throw error
      })
      try {
        await wrapped()
        expect(false).toBe(true)
      } catch (error) {
        expect(error.message).toBe('Something')
        expect(error.code).toBe('EAGAIN')
      }
    })
    it('changes message of ENOENT errors', async function() {
      const wrapped = helpersOfHelpers.wrapExec(async function() {
        await wait(10)
        const error = new Error('Failed to spawn something')
        // $FlowIgnore: Custom property
        error.code = 'ENOENT'
        // $FlowIgnore: Custom property
        error.path = 'some-file'
        throw error
      })
      try {
        await wrapped()
        expect(false).toBe(true)
      } catch (error) {
        expect(error.message).toBe('Failed to spawn command `some-file`. Make sure `some-file` is installed and on your PATH')
        expect(error.code).toBe('ENOENT')
      }
    })
    it('makes sure to kill when uniqueKey is provided', async function() {
      const wrapped = helpersOfHelpers.wrapExec(execNode)
      const firstPromise = wrapped(wait2SecondsFile, [], { uniqueKey: 'a', stream: 'stdout' })
      const secondPromise = wrapped(wait2SecondsFile, [], { uniqueKey: 'a', stream: 'stdout' })
      const thirdPromise = wrapped(wait2SecondsFile, [], { uniqueKey: 'b', stream: 'stdout' })
      const forthPromise = wrapped(wait2SecondsFile, [], { uniqueKey: 'b', stream: 'stdout' })

      expect(await firstPromise).toBe(null)
      expect(await thirdPromise).toBe(null)
      expect(await secondPromise).toBe('2 seconds have passed')
      expect(await forthPromise).toBe('2 seconds have passed')
    })
  })
})
