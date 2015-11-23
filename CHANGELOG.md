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
