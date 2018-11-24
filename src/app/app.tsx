import {remote, ipcRenderer as ipc} from 'electron'
import React, { Component } from 'react'
import ReactDOM from 'react-dom'

import { withStyles, createStyles, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import primaryColor from '@material-ui/core/colors/indigo';

import AppBar from '@material-ui/core/AppBar';
import Typography from '@material-ui/core/Typography';
import Toolbar from '@material-ui/core/Toolbar';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import '../logger/client'
import StyledWorkspace, {Workspace} from '../workspace'
import log from '../logger/client';

window["__MUI_USE_NEXT_TYPOGRAPHY_VARIANTS__"] = true


const darkTheme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: primaryColor,
  },
})
const lightTheme = createMuiTheme({
  palette: {
    type: 'light',
    primary: primaryColor,
  },
})

const TabContainer = (props) =>
    <Typography component="div" style={{ padding: 8 * 3, color: 'white'  }}>
      {props.children}
    </Typography>

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    flexGrow: 1,
    backgroundColor: palette.background.paper,
  }
});


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

  onChangeTheme() {
    const {useDarkTheme} = this.state
    this.setState({useDarkTheme: !useDarkTheme})
  }

  onKeyPress(event: KeyboardEvent) {
    console.log(event)
    this.workspace && this.workspace.onKeyPress(event)
  }

  render() {
    const {useDarkTheme} = this.state
    return (
      <MuiThemeProvider theme={useDarkTheme?darkTheme:lightTheme}>
        <div onKeyPress={this.onKeyPress.bind(this)}>
          <AppBar position="static">
            <Toolbar>
              <FormControlLabel
              control={
                <Switch
                  checked={useDarkTheme}
                  onChange={this.onChangeTheme.bind(this)}
                  value="Dark"
                />
              }
              label="Dark Theme"
            />
            </Toolbar>
          </AppBar>
          <StyledWorkspace innerRef={ref => this.workspace=ref} useDarkTheme={useDarkTheme}/>
        </div>  
      </MuiThemeProvider>
    )
  }
})

ReactDOM.render(<App/>, document.getElementById("app"));

window.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  const response = ipc.sendSync('show-context-menu', {x: event.x, y: event.y})
})
