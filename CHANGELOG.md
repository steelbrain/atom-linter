### 4.3.0

* Add `tempFiles` helper

### 4.2.0

* Use `consistent-path` package to determine `$PATH` correctly on OSX

### 4.1.1

* Export `FindCache`, now you can do `Helper.FindCache.clear()` to clear find cache

### 4.1.0

* Add `findCachedAsync` hepler
* Add `findCached` helper

### 4.0.1

* Upgrade dependencies

### 4.0.0

* Use ES6 exports instead of commonjs
* Remove `Helpers.findFile$` in favor of `Helpers.find$`
* Use XRegExp.forEach instead of splitting given input by lines and applying regex over each line (mostly backward compatible, but no guarantee)

### 3.4.1

* Revert ES6 exports to use commonjs again (broke compatibility with babel packages)
* Rename `Helpers.findFile$` to `Helpers.find$` (also exported with previous names for backward compatibility)
* Fix a non-critical bug in `Helpers.find$` where it won't search in drive root

### 3.4.0

* Add `Helpers.findFileAsync`
* Add dist files for inclusion in non-babel envs

### 3.3.9

* Revert the changes in 3.3.2, `Range()`'s end point is exclusive, not inclusive.

### 3.3.8

* Fix `rangeFromLineNumber` on files with mixed indentation

### 3.3.7

* Force lineNumber in `rangeFromLineNumber` to be within buffer range

### 3.3.6

* Handle column start in `rangeFromLineNumber`, when it is greater than line length
* Handle negative column start values and invalid line numbers

### 3.3.5

* Add `Helpers.createElement`

### 3.3.4

* Handle invalid `lineNumber` and return a valid range

### 3.3.3

* Fix an API deprecation with TextEditor

### 3.3.2

* Fix a bug in `Helpers.rangeFromLineNumber`

### 3.3.1

* Future proof a check

### 3.3.0

* Add `flags` option to `parse` method

### 3.2.2

* Show a nicer message for `EACCES` errors

### 3.2.1

* Couple of fixes for `findFile`
* Correct npm `test` script

### 3.2.0
* Add support for third-argument to `rangeFromLineNumber`

### 3.1.3
* Fixed an undefined variable reference

### 3.1.3
* Added `tempFile` method

### 3.1.2
* Added support for `both` streams
* Added a changelog

### Upto 3.1.1

* Support for {stdout, stderr} streams
* `exec` method
* `execNode` method
* `rangeFromLineNumber` method
* `parse` method
* `findFile` method
