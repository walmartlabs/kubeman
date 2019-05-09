
class LogStream {
  title: string = ''
  stream: any
}

export default class StreamLogger {
  static rowLimit: number = 0
  static logStreams: LogStream[] = []
  static buffer: string[][] = []
  static renderCounter: number  = 0
  static renderTimer: any = undefined
  static onStreamOutput: any = undefined
  static hasMoreLogs: boolean = false

  static init(rowLimit, onStreamOutput) {
    this.rowLimit = rowLimit
    this.onStreamOutput = onStreamOutput
  }

  static captureLogStream(title, stream) {
    const logStream = new LogStream()
    logStream.title = title
    logStream.stream = stream
    logStream.stream.onLog(this.onLog.bind(this, logStream))
    this.logStreams.push(logStream)
    this.renderTimer = setInterval(this.renderLog.bind(this), 2000)
  }

  static onLog(logStream: LogStream, log: string) {
    const lines = log.split("\n").filter(line => line.length > 0)
                      .slice(-this.rowLimit)
                      .map(line => [logStream.title, line])
    this.buffer = this.buffer.concat(lines)
    this.hasMoreLogs = true
  }
      
  static renderLog() {
    if(this.hasMoreLogs) {
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
