'use babel'

import {BufferedProcess, BufferedNodeProcess} from 'atom'
import Path from 'path'
import FS from 'fs'
import TMP from 'tmp'

let XRegExp = null
const XCache = new Map()
const EventsCache = new WeakMap()
