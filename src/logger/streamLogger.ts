/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import FilterUtil, {Filter} from '../util/filterUtil'

class LogStream {
  title: string = ''
  stream: any
}

export default class StreamLogger {
  static rowLimit: number = 0
  static logStreams: LogStream[] = []
  static filter: Filter
  static buffer: string[][] = []
  static renderCounter: number  = 0
  static renderTimer: any = undefined
  static onStreamOutput: any = undefined
  static hasMoreLogs: boolean = false
  static lastLogTimestamp: number = 0

  static init(rowLimit, onStreamOutput, ...filters) {
    this.stop()
    this.rowLimit = rowLimit
    this.onStreamOutput = onStreamOutput
    this.filter = FilterUtil.createFilter(...filters)
  }

  static captureLogStream(title, stream) {
    const logStream = new LogStream()
    logStream.title = title
    logStream.stream = stream
    stream.onLog(this.onLog.bind(this, logStream))
    this.logStreams.push(logStream)
    this.renderTimer = setInterval(this.renderLog.bind(this), 2000)
  }

  static onLog(logStream: LogStream, log: string) {
    this.hasMoreLogs = true
    let lines = log.split("\n").filter(line => line.length > 0);
    lines = this.filter.filter(lines)
    const newBuffer = lines.slice(-this.rowLimit).map(line => [logStream.title, line])
    this.buffer = this.buffer.concat(newBuffer)
  }
      
  static renderLog() {
    if(this.hasMoreLogs) {
      const now = Date.now()

      let overflow = false
      if(this.lastLogTimestamp > 0) {
        const elapsedSeconds = Math.ceil((now - this.lastLogTimestamp)/1000)
        const logFrequency = this.buffer.length/elapsedSeconds
        if(this.rowLimit > 0 && elapsedSeconds > 0 && logFrequency > this.rowLimit) {
          overflow = true
          this.buffer.push(["Too many logs. Please use filtered logs option."])
          this.stop()
        }
      } 
      this.lastLogTimestamp = now
      this.onStreamOutput && this.onStreamOutput(this.buffer)
      this.buffer = []
      this.hasMoreLogs = false
    }
  }

  static stop() {
    if(this.logStreams.length > 0) {
      this.logStreams.forEach(logStream => logStream.stream.stop())
      this.logStreams = []
    }
    if(this.renderTimer) {
      clearInterval(this.renderTimer)
    }
  }
}
