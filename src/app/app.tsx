/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ipcRenderer as ipc, webFrame, screen} from 'electron'
import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { CssBaseline, LinearProgress, Typography } from '@material-ui/core'
import StyledWorkspace, {Workspace} from '../workspace/workspace'
import {appTheme} from '../theme/theme'
import 'roboto-fontface/css/roboto-condensed/roboto-condensed-fontface.css'
import 'typeface-roboto/index.css'
import 'typeface-roboto-mono/index.css'
import styles from './app.styles'


window["__MUI_USE_NEXT_TYPOGRAPHY_VARIANTS__"] = true

const darkTheme = createMuiTheme(appTheme.darkTheme)
const lightTheme = createMuiTheme(appTheme.lightTheme)
global['useDarkTheme'] = false


interface IState {
  useDarkTheme: boolean,
  openingNewWindow: boolean
}
interface IProps extends WithStyles<typeof styles> {
}

const App = withStyles(styles)(
class extends Component<IProps, IState> {
  workspace: Workspace|undefined
  state = {
    useDarkTheme: global['useDarkTheme'],
    openingNewWindow: false,
  }
  ctrlPressed: boolean = false
  cmdPressed: boolean = false
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
        this.ctrlPressed = true
        break
      case 91:
        this.cmdPressed = true
        break
      case 187:
        (this.cmdPressed || this.ctrlPressed) && this.zoomIn()
        break
      case 189:
        (this.cmdPressed || this.ctrlPressed) && this.zoomOut()
        break
      case 78:
        if(this.cmdPressed) {
          this.setState({openingNewWindow: true})
          setTimeout(() => this.setState({openingNewWindow: false}), 8000)
        }
        break
      default:
          this.ctrlPressed = false
          this.cmdPressed = false
    }
  }

  onKeyUp = (event) => {
    switch(event.which) {
      case 17:
        this.ctrlPressed = false
        break
      case 91:
        this.cmdPressed = false
        break
    }
  }

  render() {
    const {useDarkTheme, openingNewWindow} = this.state
    const {classes} = this.props

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
        {openingNewWindow && 
          <div style={{zIndex: 1000}}>
            <Typography variant="h5" gutterBottom className={classes.loadingMessage}>
              Opening New Window...
            </Typography>
            <LinearProgress className={classes.loading} />
          </div>
        }
      </MuiThemeProvider>
    )
  }
})

ReactDOM.render(<App/>, document.getElementById("app"))

window.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  ipc.send('showContextMenu', {x: event.x+40, y: event.y+40})
})
