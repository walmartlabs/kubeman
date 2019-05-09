import {ipcRenderer as ipc, webFrame, screen} from 'electron'
import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { withStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { CssBaseline } from '@material-ui/core'
import StyledWorkspace, {Workspace} from '../workspace/workspace'
import {appTheme} from '../theme/theme'
import 'roboto-fontface/css/roboto/roboto-fontface.css'
import 'typeface-roboto/index.css'
import styles from './app.styles'


window["__MUI_USE_NEXT_TYPOGRAPHY_VARIANTS__"] = true

const darkTheme = createMuiTheme(appTheme.darkTheme)
const lightTheme = createMuiTheme(appTheme.lightTheme)
global['useDarkTheme'] = false


interface IState {
  useDarkTheme: boolean,
}
interface IProps {
}

const App = withStyles(styles)(
class extends Component<IProps, IState> {
  workspace: Workspace|undefined
  state = {
    useDarkTheme: global['useDarkTheme'],
  }
  ctrlPressed: boolean = false
  zoomFactor: number = 1


  componentDidMount() {
    appTheme.setActiveTheme(global['useDarkTheme'])
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    if(width > 1920) {
      this.zoomIn()
    }
    window.addEventListener("focus", this.onFocus)
  }
  
  componentWilUnmount() {
    window.removeEventListener("focus", this.onFocus)
  }

  onFocus = () => {
    this.ctrlPressed = false
  }

  onChangeTheme = () => {
    let {useDarkTheme} = this.state
    useDarkTheme = !useDarkTheme
    appTheme.setActiveTheme(useDarkTheme)
    global['useDarkTheme'] = useDarkTheme
    this.setState({useDarkTheme})
  }

  zoomIn() {
    if(this.zoomFactor < 1.5) {
      this.zoomFactor += 0.1
      webFrame.setZoomFactor(this.zoomFactor)
    }
  }

  zoomOut() {
    if(this.zoomFactor > 0.8) {
      this.zoomFactor -= 0.1
      webFrame.setZoomFactor(this.zoomFactor)
    }
  }


  onKeyDown = (event) => {
    switch(event.which) {
      case 17:
      case 18:
      case 91:
        this.ctrlPressed = true
        break
      case 187:
        this.ctrlPressed && this.zoomIn()
        break
      case 189:
        this.ctrlPressed && this.zoomOut()
        break
    }
  }

  onKeyUp = (event) => {
    switch(event.which) {
      case 17:
      case 18:
      case 91:
        this.ctrlPressed = false
        break
    }
  }

  render() {
    const {useDarkTheme} = this.state
    return (
      <MuiThemeProvider theme={useDarkTheme ? darkTheme : lightTheme}>
        <CssBaseline />
        <div  style={{width: '100%'}}
              onKeyDown={this.onKeyDown}
              onKeyUp={this.onKeyUp} >
          <StyledWorkspace 
              innerRef={ref => this.workspace=ref} 
              onChangeTheme={this.onChangeTheme}
          />
        </div>  
      </MuiThemeProvider>
    )
  }
})

ReactDOM.render(<App/>, document.getElementById("app"))

window.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  ipc.send('show-context-menu', {x: event.x, y: event.y})
})
