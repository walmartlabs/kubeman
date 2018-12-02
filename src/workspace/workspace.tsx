import React from "react";
import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableBody, TableRow, TableCell } from "@material-ui/core";
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import Actions from '../actions/actions'
import ContextPanel from '../context/contextPanel'
import ContextSelector from '../context/contextSelector'
import Context from "../context/contextStore";
import Terminal from '../output/terminal'
import TerminalBox from "../output/terminalBox";
import BlackBox from '../output/blackbox'
import TableBox from '../output/tableBox'
import HealthStatusBox from '../output/healthStatusBox'
import {ActionOutput, ActionOutputStyle} from '../actions/actionSpec'

import styles from './workspace.styles'

interface IState {
  context: Context
  output: ActionOutput
  outputStyle: ActionOutputStyle
}

interface IProps extends WithStyles<typeof styles> {
  onChangeTheme: (boolean) => void
}
interface IRefs {
  [k: string]: any
  terminal: TerminalBox|undefined
  contextSelector: ContextSelector|undefined
}

export class Workspace extends React.Component<IProps, IState, IRefs> {
  refs: IRefs = {
    terminal: undefined,
    contextSelector: undefined
  }
  state: IState = {
    context: new Context,
    output: [],
    outputStyle: ActionOutputStyle.Table
  }
  commandHandler?: ((string) => void) = undefined

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
  }

  registerCommandHandler(commandHandler: (string) => void) {
    this.commandHandler = commandHandler
  }

  onCommand = (command: string) => {
    this.commandHandler && this.commandHandler(command)
  }

  showOutput = (output: ActionOutput, outputStyle: ActionOutputStyle) => {
    //this.refs.terminal && this.refs.terminal.write(output)
    this.setState({output, outputStyle: outputStyle || ActionOutputStyle.Text})
  }

  onUpdateContext = (context: Context) => {
    this.setState({context: context})
  }

  onKeyPress(event: KeyboardEvent) {
    const { contextSelector } = this.refs
    contextSelector && contextSelector.onKeyPress(event)
  }

  onSelectCluster() {
    const { contextSelector } = this.refs
    contextSelector && contextSelector.selectClusters()
  }

  render() {
    const { classes } = this.props;
    const { context, output, outputStyle } = this.state;
    const showBlackBox = outputStyle === ActionOutputStyle.Text
    const showTableBox = outputStyle === ActionOutputStyle.Table
    const showHealthStatusBox = outputStyle === ActionOutputStyle.Health

    return (
      <div className={classes.root} 
            tabIndex={0}
            //onKeyPress={this.onKeyPress.bind(this)}
      >
        <Table className={classes.table}>
          <TableBody>
            <TableRow className={classes.upperRow}>
              <TableCell colSpan={2} className={classes.contextCell}>
                <ContextPanel context={context} 
                    onUpdateContext={this.onUpdateContext}
                    onSelectContext={this.onSelectCluster.bind(this)} />
              </TableCell>
            </TableRow>
            <TableRow className={classes.lowerRow}>
              <TableCell className={classes.actionCell}>
                <Actions context={context}
                        onCommand={this.onCommand}
                        onOutput={this.showOutput}
                        />
              </TableCell>
              <TableCell className={classes.outputCell}>
                {showBlackBox && <BlackBox output={output} />}
                {showTableBox && <TableBox output={output} />}
                {showHealthStatusBox && <HealthStatusBox output={output} />}
                
                {/* <TerminalBox 
                  ref='terminal' 
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    width: '80%',
                    height: '80%'
                  }}
                  options={{cols:'60', rows:'40'}}
                /> */}
                {/* <Terminal ref='terminal' 
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    width: '80%',
                    height: '80%'
                  }}
                  options={{cols:'60', rows:'40'}}
                  addons={['fit', 'fullscreen', 'search']}
                  connected={true}
                  registerCommandHandler={this.registerCommandHandler.bind(this)}
                /> */}
              </TableCell>
            </TableRow>
            <TableRow className={classes.bottomRow}>
              <TableCell className={classes.bottomRow}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={global['useDarkTheme']}
                      onChange={this.props.onChangeTheme}
                      value="Dark"
                    />
                  }
                  label="Dark Theme"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <ContextSelector ref='contextSelector'
            context={context} 
            onUpdateContext={this.onUpdateContext.bind(this)} />
      </div>
    );
  }
}

export default withStyles(styles)(Workspace)