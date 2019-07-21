/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import FilterUtil, {Filter} from '../util/filterUtil'

class LogStream {
  title: string = ''
  stream?: any
}

export default class StreamLogger {
  static RenderInterval = 3000
  static rowLimit: number = 0
  static logStreams: LogStream[] = []
  static filter: Filter
  static buffer: string[][] = []
  static renderTimer: any = undefined
  static onStreamOutput: any = undefined
  static hasMoreLogs: boolean = false
  static newLogCount: number = 0
  static logEvery: number = 0
  static continousLogCalls: number = 0
  static firstLogsRendered: boolean = false;

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
    this.renderTimer = setInterval(this.renderLog.bind(this), this.RenderInterval)
  }

  static onLog(logStream: LogStream, log: string) {
    if(++this.continousLogCalls > this.rowLimit*4) {
      this.stopOnHeavyLogs(true)
      return
    }
    let lines = log.split("\n").filter(line => line.length > 0);
    lines = this.filter.filter(lines)
    const newBuffer = lines.map(line => [logStream.title, line])
    this.newLogCount += newBuffer.length
    if(newBuffer.length > 0) {
      this.hasMoreLogs = true
      this.buffer = this.buffer.concat(newBuffer)
      if(this.logEvery > 0) {
        this.buffer = this.buffer.filter((l,i) => i % this.logEvery === 0)
      }
      this.buffer = this.buffer.slice(-this.rowLimit)
    }
  }
      
  static renderLog() {
    this.continousLogCalls = 0
    if(this.hasMoreLogs) {
      if(this.rowLimit > 0 && this.newLogCount > this.rowLimit && this.firstLogsRendered) {
        if(this.filter.hasFilters && this.logEvery < 5) {
          this.buffer.push(["", "Too many logs. Throttling..."])
          this.logEvery += 2
        } else {
          this.stopOnHeavyLogs()
        }
      } else if(this.logEvery > 0) {
        this.logEvery--
      }
      this.onStreamOutput && this.onStreamOutput(this.buffer)
      this.buffer = []
      this.hasMoreLogs = false
      this.newLogCount = 0
      this.firstLogsRendered = true
    }
  }

  static stopOnHeavyLogs(tooManyUnfiltered: boolean = false) {
    if(tooManyUnfiltered) {
      this.onStreamOutput && this.onStreamOutput([["", "Too many logs not giving the app a chance to display. Stopping. Filter " + this.filter.text + " cannot help. Use kubectl instead."]])
    } else if(this.filter.hasFilters) {
      this.onStreamOutput && this.onStreamOutput([["", "Too many logs. Stopping. Please consider using a narrower filter than " + this.filter.text]])
    } else {
      this.onStreamOutput && this.onStreamOutput([["", "Too many logs. Stopping. Please use filtered logs option."]])
    }
    this.stop()
  }

  static stop() {
    if(this.logStreams.length > 0) {
      this.logStreams.forEach(logStream => logStream.stream && logStream.stream.stop())
      this.logStreams = []
    }
    if(this.renderTimer) {
      clearInterval(this.renderTimer)
    }
    this.renderTimer = undefined
    this.buffer = []
    this.newLogCount = 0
    this.hasMoreLogs = false
    this.firstLogsRendered = false
  }
}
