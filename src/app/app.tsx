import {remote, ipcRenderer as ipc} from 'electron'
import React, { Component } from 'react'
import ReactDOM from 'react-dom'

import { withStyles, createStyles, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import primaryColor from '@material-ui/core/colors/indigo';

import Typography from '@material-ui/core/Typography';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import '../logger/client'
import StyledWorkspace, {Workspace} from '../workspace/workspace'
import log from '../logger/client';
import {appTheme} from '../theme/theme'

import 'roboto-fontface/css/roboto/roboto-fontface.css'
import 'typeface-roboto/index.css'
import { CssBaseline } from '@material-ui/core';

import styles from './app.styles'


window["__MUI_USE_NEXT_TYPOGRAPHY_VARIANTS__"] = true

const darkTheme = createMuiTheme(appTheme.darkTheme)
const lightTheme = createMuiTheme(appTheme.lightTheme)
global['useDarkTheme'] = false


const TabContainer = (props) =>
    <Typography component="div" style={{ padding: 8 * 3, color: 'white'  }}>
      {props.children}
    </Typography>



ipc.on('asynchronous-reply', (event: Electron.Event, arg: any) => {
  console.log(arg)
})

interface IState {
  useDarkTheme: boolean,
}
interface IProps {
}

const App = withStyles(styles)(
class extends Component<IProps, IState> {
  workspace: Workspace|undefined
  state = {
    useDarkTheme: false,
  };

  componentDidMount() {
  }

  onChangeTheme = () => {
    let {useDarkTheme} = this.state
    useDarkTheme = !useDarkTheme
    appTheme.setActiveTheme(useDarkTheme)
    global['useDarkTheme'] = useDarkTheme
    this.setState({useDarkTheme})
  }

  onKeyPress = (event: KeyboardEvent) => {
    console.log(event)
    this.workspace && this.workspace.onKeyPress(event)
  }

  render() {
    const {useDarkTheme} = this.state
    return (
      <MuiThemeProvider theme={useDarkTheme ? darkTheme : lightTheme}>
        <CssBaseline />
        <div style={{width: '100%'}}> {/* onKeyPress={this.onKeyPress} */}
          <StyledWorkspace 
              innerRef={ref => this.workspace=ref} 
              onChangeTheme={this.onChangeTheme}
          />
        </div>  
      </MuiThemeProvider>
    )
  }
})

ReactDOM.render(<App/>, document.getElementById("app"));

window.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  ipc.send('show-context-menu', {x: event.x, y: event.y})
})
