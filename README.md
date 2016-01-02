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
  static findAsync(directory: Strng, names: String | Array<string>): Promise<?String>
  static findCachedAsync(directory: Strng, names: String | Array<string>): Promise<?String>
  static tempFile<T>(fileName:String, fileContents:String, Callback:Function<T>):Promise<T>
  static tempFiles<T>(filesNames:Array<{name: String, contents: String}>, callback:Function<T>):Promise<T>
  static createElement(tagName: string): HTMLElement
}
```

#### Explanation for createElement

Linter accepts `HTMLElement`s in the `html` message property. To show the same message on more
than one DOM Elements, it clones the element. It's a limitation of HTMLElements that they
lose all the events on clone. If you create your element using `Helpers.createElement` however
It'll make sure the children inherit the events from the parent.

#### License

This project is licensed under the terms of MIT License, see the LICENSE file for more info
