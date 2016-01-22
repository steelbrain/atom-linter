'use strict';
'use babel';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FindCache = undefined;
exports.exec = exec;
exports.execNode = execNode;
exports.rangeFromLineNumber = rangeFromLineNumber;
exports.findAsync = findAsync;
exports.findCachedAsync = findCachedAsync;
exports.find = find;
exports.findCached = findCached;
exports.tempFile = tempFile;
exports.tempFiles = tempFiles;
exports.parse = parse;

var _atom = require('atom');

var _path = require('path');

var Path = _interopRequireWildcard(_path);

var _fs = require('fs');

var FS = _interopRequireWildcard(_fs);

var _tmp = require('tmp');

var TMP = _interopRequireWildcard(_tmp);

var _consistentPath = require('consistent-path');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

let NamedRegexp = null;
const FindCache = exports.FindCache = new Map();

// TODO: Remove this when electron upgrades node
const assign = Object.assign || function (target, source) {
  for (const key in source) {
    target[key] = source[key];
  }
  return target;
};

function _exec(command, args, opts, isNode) {
  const options = assign({
    env: assign({}, process.env),
    stream: 'stdout',
    throwOnStdErr: true
  }, opts);

  if (isNode) {
    delete options.env.OS;
  }
  assign(options.env, { PATH: (0, _consistentPath.getPath)() });

  return new Promise(function (resolve, reject) {
    const data = { stdout: [], stderr: [] };
    const parameters = {
      command: command,
      args: args,
      options: options,
      stdout: function (chunk) {
        data.stdout.push(chunk);
      },
      stderr: function (chunk) {
        data.stderr.push(chunk);
      },
      exit: function () {
        if (options.stream === 'stdout') {
          if (data.stderr.length && options.throwOnStdErr) {
            reject(new Error(data.stderr.join('')));
          } else {
            resolve(data.stdout.join(''));
          }
        } else if (options.stream === 'stderr') {
          resolve(data.stderr.join(''));
        } else {
          resolve({ stdout: data.stdout.join(''), stderr: data.stderr.join('') });
        }
      }
    };
    const spawnedProcess = isNode ? new _atom.BufferedNodeProcess(parameters) : new _atom.BufferedProcess(parameters);

    spawnedProcess.onWillThrowError(function (_ref) {
      let error = _ref.error;
      let handle = _ref.handle;

      if (error.code !== 'ENOENT') {
        handle();
      }
      if (error.code === 'EACCES') {
        const newError = new Error(`Failed to spawn command '${ command }'. Make sure it's a file, not a directory and it's executable.`);
        newError.name = 'BufferedProcessError';
        reject(newError);
      }
      reject(error);
    });

    if (options.stdin) {
      try {
        spawnedProcess.process.stdin.write(options.stdin.toString());
        spawnedProcess.process.stdin.end();
      } catch (_) {}
    }
  });
}

function validate_exec(command, args, options) {
  if (typeof command !== 'string') {
    throw new Error('Invalid or no `command` provided');
  } else if (!(args instanceof Array)) {
    throw new Error('Invalid or no `args` provided');
  } else if (typeof options !== 'object') {
    throw new Error('Invalid or no `options` provided');
  }
}
function validate_find(directory, name) {
  if (typeof directory !== 'string') {
    throw new Error('Invalid or no `directory` provided');
  } else if (typeof name !== 'string' && !(name instanceof Array)) {
    throw new Error('Invalid or no `name` provided');
  }
}

function exec(command) {
  let args = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];
  let options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  validate_exec(command, args, options);
  return _exec(command, args, options, false);
}

function execNode(command) {
  let args = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];
  let options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  validate_exec(command, args, options);
  return _exec(command, args, options, true);
}

function rangeFromLineNumber(textEditor, lineNumber, colStart) {
  if (typeof textEditor.getText !== 'function') {
    throw new Error('Invalid textEditor provided');
  }

  if (typeof lineNumber !== 'number' || lineNumber !== lineNumber || lineNumber < 0) {
    return [[0, 0], [0, 1]];
  }

  const buffer = textEditor.getBuffer();
  const lineMax = buffer.getLineCount() - 1;

  if (lineNumber > lineMax) {
    throw new Error(`Line number (${ lineNumber }) greater than maximum line (${ lineMax })`);
  }

  if (typeof colStart !== 'number' || colStart !== colStart || colStart < 0) {
    const indentation = buffer.lineForRow(lineNumber).match(/^\s+/);
    if (indentation && indentation.length) {
      colStart = indentation[0].length;
    } else {
      colStart = 0;
    }
  }

  const lineLength = buffer.lineLengthForRow(lineNumber);

  if (colStart > lineLength) {
    throw new Error(`Column start (${ colStart }) greater than line length (${ lineLength })`);
  }

  return [[lineNumber, colStart], [lineNumber, lineLength]];
}

function findAsync(directory, name) {
  validate_find(directory, name);
  const names = name instanceof Array ? name : [name];
  const chunks = directory.split(Path.sep);
  let promise = Promise.resolve(null);

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep);
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/');
    }
    promise = promise.then(function (filePath) {
      if (filePath !== null) {
        return filePath;
      }
      return names.reduce(function (promise, name) {
        const currentFile = Path.join(currentDir, name);
        return promise.then(function (filePath) {
          if (filePath !== null) {
            return filePath;
          }
          return new Promise(function (resolve) {
            FS.access(currentFile, FS.R_OK, function (error) {
              if (error) {
                resolve(null);
              } else resolve(currentFile);
            });
          });
        });
      }, Promise.resolve(null));
    });
    chunks.pop();
  }

  return promise;
}

function findCachedAsync(directory, name) {
  validate_find(directory, name);
  const names = name instanceof Array ? name : [name];
  const cacheKey = directory + ':' + names.join(',');

  if (FindCache.has(cacheKey)) {
    const cachedFilePath = FindCache.get(cacheKey);
    return new Promise(function (resolve) {
      FS.access(cachedFilePath, FS.R_OK, function (error) {
        if (error) {
          FindCache.delete(cacheKey);
          resolve(findCachedAsync(directory, names));
        } else resolve(cachedFilePath);
      });
    });
  } else {
    return findAsync(directory, name).then(function (filePath) {
      FindCache.set(cacheKey, filePath);
      return filePath;
    });
  }
}

function find(directory, name) {
  validate_find(directory, name);
  const names = name instanceof Array ? name : [name];
  const chunks = directory.split(Path.sep);

  while (chunks.length) {
    let currentDir = chunks.join(Path.sep);
    if (currentDir === '') {
      currentDir = Path.resolve(directory, '/');
    }
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = names[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        const fileName = _step.value;

        const filePath = Path.join(currentDir, fileName);

        try {
          FS.accessSync(filePath, FS.R_OK);
          return filePath;
        } catch (_) {}
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    chunks.pop();
  }

  return null;
}

function findCached(directory, name) {
  validate_find(directory, name);
  const names = name instanceof Array ? name : [name];
  const cacheKey = directory + ':' + names.join(',');

  if (FindCache.has(cacheKey)) {
    const cachedFilePath = FindCache.get(cacheKey);
    try {
      FS.accessSync(cachedFilePath, FS.R_OK);
      return cachedFilePath;
    } catch (_) {
      FindCache.delete(cacheKey);
    }
  }
  const filePath = find(directory, names);
  if (filePath) {
    FindCache.set(cacheKey, filePath);
  }
  return filePath;
}

function tempFile(fileName, fileContents, callback) {
  if (typeof fileName !== 'string') {
    throw new Error('Invalid or no `fileName` provided');
  } else if (typeof fileContents !== 'string') {
    throw new Error('Invalid or no `fileContents` provided');
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided');
  }

  return tempFiles([{
    'name': fileName,
    'contents': fileContents
  }], function (results) {
    return callback(results[0]);
  });
}

function tempFiles(files, callback) {
  if (!Array.isArray(files)) {
    throw new Error('Invalid or no `files` provided');
  } else if (typeof callback !== 'function') {
    throw new Error('Invalid or no `callback` provided');
  }

  return new Promise(function (resolve, reject) {
    TMP.dir({
      prefix: 'atom-linter_'
    }, function (error, directory, directoryCleanup) {
      if (error) {
        directoryCleanup();
        return reject(error);
      }
      let foundError = false;
      let filePaths = null;
      Promise.all(files.map(function (file) {
        const fileName = file.name;
        const fileContents = file.contents;
        const filePath = Path.join(directory, fileName);
        return new Promise(function (resolve, reject) {
          FS.writeFile(filePath, fileContents, function (error) {
            if (error) {
              // Note: Intentionally not doing directoryCleanup 'cause it won't work
              // Because we would've already wrote a few files and when even file
              // exists in a directory, it can't be removed
              reject(error);
            } else resolve(filePath);
          });
        });
      })).then(function (_filePaths) {
        return callback(filePaths = _filePaths);
      }).catch(function (result) {
        foundError = true;
        return result;
      }).then(function (result) {
        if (filePaths !== null) {
          Promise.all(filePaths.map(function (filePath) {
            return new Promise(function (resolve) {
              FS.unlink(filePath, resolve);
            });
          })).then(directoryCleanup);
        }
        if (foundError) {
          throw result;
        } else return result;
      }).then(resolve, reject);
    });
  });
}

function parse(data, regex) {
  let opts = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  if (typeof data !== 'string') {
    throw new Error('Invalid or no `data` provided');
  } else if (typeof regex !== 'string') {
    throw new Error('Invalid or no `regex` provided');
  } else if (typeof opts !== 'object') {
    throw new Error('Invalid or no `options` provided');
  }

  if (NamedRegexp === null) {
    NamedRegexp = require('named-js-regexp');
  }

  const options = assign({ flags: '' }, opts);
  if (options.flags.indexOf('g') === -1) {
    options.flags += 'g';
  }

  const messages = [];
  const compiledRegexp = NamedRegexp(regex, options.flags);
  let rawMatch = null;

  while ((rawMatch = compiledRegexp.exec(data)) !== null) {
    const match = rawMatch.groups();
    const type = match.type;
    const text = match.message;
    const file = match.file || options.filePath || null;

    const lineStart = match.lineStart || match.line || 0;
    const colStart = match.colStart || match.col || 0;
    const lineEnd = match.lineEnd || match.line || 0;
    const colEnd = match.colEnd || match.col || 0;

    messages.push({
      type: type,
      text: text,
      filePath: file,
      range: [[lineStart > 0 ? lineStart - 1 : 0, colStart > 0 ? colStart - 1 : 0], [lineEnd > 0 ? lineEnd - 1 : 0, colEnd > 0 ? colEnd - 1 : 0]]
    });
  }

  return messages;
}

