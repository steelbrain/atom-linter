atom-linter
===========

atom-linter is an npm helper module that you can import in your Linter Providers
and make things easier for yourself.

#### API

```js
enum stream = {stdout, stderr, both}
class Helpers{
  static exec(command: String, args: Array<string> = [], options: Object = {stream: 'stdout'})
  static execNode(filePath: String, args: Array<string> = [], options: Object = {stream: 'stdout'})
  static parse(data: String, regex: String, options: Object = {baseReduction: 1})
  static rangeFromLineNumber(textEditor: TextEditor, lineNumber: Number):Range
  static findFile(directory:String, names: String | Array<string>)
  static tempFile<T>(filePath:String, fileContents:String, Callback:Function<T>):Promise<T>
}
```

#### License

This project is licensed under the terms of MIT License, see the LICENSE file for more info
