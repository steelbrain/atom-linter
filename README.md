atom-linter
===========

atom-linter is an npm helper module that you can import in your Linter Providers
and make things easier for yourself.

#### API

```js
enum stream = {stdout, stderr, both}
export const FindCache: Map
class Helpers{
  static exec(command: String, args: Array<string> = [], options: Object = {stream: 'stdout'})
  static execNode(filePath: String, args: Array<string> = [], options: Object = {stream: 'stdout'})
  static parse(data: String, regex: String, options: Object = {baseReduction: 1, flags: ""})
  static rangeFromLineNumber(textEditor: TextEditor, lineNumber: Number, colStart: Number = <firstColumn>):Array
  static find(directory:String, names: String | Array<string>): ?String
  static findCached(directory:String, names: String | Array<string>): ?String
  static findAsync(directory: String, names: String | Array<string>): Promise<?String>
  static findCachedAsync(directory: String, names: String | Array<string>): Promise<?String>
  static tempFile<T>(fileName:String, fileContents:String, Callback:Function<T>):Promise<T>
  static tempFiles<T>(filesNames:Array<{name: String, contents: String}>, callback:Function<T>):Promise<T>
}
```

#### License

This project is licensed under the terms of MIT License, see the LICENSE file for more info
