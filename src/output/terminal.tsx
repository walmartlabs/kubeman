import * as React from "react"
import os from "os"
const pty = require("node-pty")
import { Terminal as XTerm } from "xterm"
import * as className from "classnames"
require("xterm/src/xterm.css")
import log from "../logger/client"

type CommandHandler = (string) => void

interface IProps extends React.DOMAttributes<{}> {
  addons?: string[]
  options?: any
  path?: string
  output?: string
  className?: string
  style?: React.CSSProperties
  connected?: boolean
  onChange?: (e) => void
  onInput?: (e) => void
  onFocusChange?: Function
  onScroll?: (e) => void
  onContextMenu?: (e) => void
  registerCommandHandler?: (CommandHandler) => void
}
interface IState {
  isFocused: boolean
}

export default class Terminal extends React.Component<IProps, IState> {
  xterm: XTerm | null = null;
  container: HTMLDivElement | null = null;
  ptyProcess: any
  isExecutionStarted: boolean = false
  isExecutionFinished: boolean = false
  command: string = ''

  constructor(props: IProps, context?: any) {
    super(props, context);
    this.state = {
      isFocused: false
    }
  }

  applyAddon(addon) {
    XTerm.applyAddon(addon)
  }
  
  componentDidMount() {
    const {addons, options, onContextMenu, onInput, output, connected,
            registerCommandHandler} = this.props
    const self = this
    if (addons) {
      addons.forEach(s => {
        const addon = require(`xterm/dist/addons/${s}/${s}.js`)
        XTerm.applyAddon(addon)
      })
    }
    this.xterm = new XTerm(options)
    this.container && this.xterm.open(this.container)

    this.xterm.on("focus", this.focusChanged.bind(this, true))
    this.xterm.on("blur", this.focusChanged.bind(this, false))

    onContextMenu &&
      this.xterm.element.addEventListener("contextmenu", onContextMenu)

    onInput && this.xterm.on("data", onInput)

    output && this.write(output)

    if(connected) {

      const shell = process.env[os.platform() === "win32" ? "powershell.exe" : "SHELL"]
      const env = {}
      Object.keys(process.env)
        .filter(key => process.env[key])
        .forEach(key => (env[key] = process.env[key]))
    
      this.ptyProcess = shell && pty.spawn(shell, [], {
          name: "xterm",
          cols: 80,
          rows: 100,
          cwd: process.cwd(),
          env: env
        })
    
      this.ptyProcess.write("stty -echo\n")

      // Setup communication between xterm.js and node-pty
      this.xterm.on("data", data => {
        //self.ptyProcess.write(data)
      })

      
      this.ptyProcess.on("data", function(data) {
        self.showCommandOutput(data)
      })

      registerCommandHandler && registerCommandHandler(this.onCommand.bind(this))
    }
  }

  componentWillUnmount() {
    if (this.xterm) {
      this.xterm.destroy()
      this.xterm = null
      this.resetCommand()
    }
  }

  resetCommand() {
    this.command = ''
    this.isExecutionStarted = this.isExecutionFinished = false
}

  onCommand(command) {
    this.resetCommand()
    this.command = command
    //this.props.connected && this.ptyProcess.write("echo 'kubeman_start'; " + command + "; echo 'kubeman_end';\n")
    this.props.connected && this.ptyProcess.write(command + "\n")
  }

  showCommandOutput(data: string) {
    this.write(data)
  }

  showCommandOutput2(data: string) {
    //console.log("pty data: %s", data)
    if(!this.isExecutionStarted) {
      //log.onClient("Execution not started yet. Data = %s", data)
      this.detectExecutionStart(data)
    } else if(!this.isExecutionFinished) {
      //log.onClient("Execution not finished yet")
      this.detectExecutionFinish(data)
    }
  }

  detectExecutionStart(data: string) {
    if(data.includes("kubeman_start")) {
      let pieces = data.split("kubeman_start")
      pieces.length > 1 ? data = pieces[1] : data = ''
      pieces = data.split("kubeman_start")
      pieces.length > 1 && (data = pieces[1])
      pieces = data.split("kubeman_end")
      pieces.length > 1 && (data = pieces[1])
      this.write(data)
      //log.onClient("ExecutionStarted. data = " + data)
      this.isExecutionStarted = true
      //this.writeln("================================= START =====================================")
    }
  }

  detectExecutionFinish(data: string) {
    this.isExecutionFinished = data.includes("kubeman_end")

    let pieces = data.split("kubeman_start")
    pieces.length > 1 && (data = pieces[1])
    pieces = data.split("kubeman_end")
    pieces.length > 0 && (data = pieces[0])
    this.write(data)
    if(this.isExecutionFinished) {
      //log.onClient("Execution finished")
      //this.writeln("================================= END =====================================")
    }
  }

  clear() {
    if(this.xterm) {
      this.xterm.clear()
      this.xterm.write("\n\r")
      this.xterm.clear()
    }
  }

  write(data: any) {
    this.xterm && this.xterm.write(data)
  }
  writeln(data: any) {
    this.xterm && this.xterm.writeln(data)
  }
  focus() {
    this.xterm && this.xterm.focus()
  }
  focusChanged(focused) {
    this.setState({isFocused: focused})
    this.props.onFocusChange && this.props.onFocusChange(focused)
  }

  resize(cols: number, rows: number) {
    this.xterm && this.xterm.resize(Math.round(cols), Math.round(rows))
  }
  setOption(key: string, value: boolean) {
    this.xterm && this.xterm.setOption(key, value)
  }
  refresh() {
    this.xterm && this.xterm.refresh(0, this.xterm.rows - 1)
  }

  render() {
    const terminalClassName = className(
      "ReactXTerm",
      this.state.isFocused ? "ReactXTerm--focused" : null,
      this.props.className
    )
    return (
      <div ref={ref => (this.container = ref)} className={terminalClassName} />
    )
  }
}
