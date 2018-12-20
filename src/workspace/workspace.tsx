import React from "react";
import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableBody, TableRow, TableCell, CircularProgress } from "@material-ui/core";
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import Actions from '../actions/actions'
import ActionChoiceDialog from '../actions/actionChoiceDialog'
import ContextPanel from '../context/contextPanel'
import ContextSelector from '../context/contextSelector'
import Context from "../context/contextStore";
import Terminal from '../output/terminal'
import TerminalBox from "../output/terminalBox";
import BlackBox from '../output/blackbox'
import TableOutput, {TableBox} from '../output/tableBox'
import {ActionOutput, ActionOutputStyle, ActionOutputCollector, ActionStreamOutputCollector,
        ActionChoiceMaker, ActionChoices, BoundActionAct} from '../actions/actionSpec'

import styles from './workspace.styles'

interface IState {
  context: Context
  output: ActionOutput|string[]
  outputStyle: ActionOutputStyle
  loading: boolean
  showChoices: boolean
  minChoices: number
  maxChoices: number
  choiceTitle: string
  choices: any[]
  deferredAction?: BoundActionAct
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
    contextSelector: undefined,
  }
  state: IState = {
    context: new Context,
    output: [],
    outputStyle: ActionOutputStyle.Table,
    loading: false,
    showChoices: false,
    minChoices: 0,
    maxChoices: 0,
    choiceTitle: '',
    choices: [],
  }
  commandHandler?: ((string) => void) = undefined
  tableBox?: TableBox

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

  showOutput : ActionOutputCollector = (output, outputStyle) => {
    this.setState({
      output, 
      outputStyle: outputStyle || ActionOutputStyle.Text, 
      loading: false,
    })
  }

  showStreamOutput : ActionStreamOutputCollector = (output) => {
    this.tableBox && this.tableBox.appendOutput(output as ActionOutput)
  }

  showChoices : ActionChoiceMaker = (act, title, choices, minChoices, maxChoices) => {
    this.setState({
      choices,
      minChoices,
      maxChoices,
      choiceTitle: title, 
      showChoices: true,
      deferredAction: act,
    })
  }

  onSelectActionChoice = (selections: ActionChoices) => {
    const {context, deferredAction} = this.state
    context.selections = selections
    this.setState({showChoices: false})
    deferredAction && deferredAction()
  }

  onCancelActionChoice = () => {
    this.setState({showChoices: false, loading: false})
  }

  showLoading = () => {
    this.setState({loading: true, outputStyle: ActionOutputStyle.None})
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
    const { context, output, outputStyle, loading, 
      showChoices, minChoices, maxChoices, choiceTitle, choices } = this.state;

    const showBlackBox = outputStyle === ActionOutputStyle.Text
    const showTable = outputStyle === ActionOutputStyle.Table || outputStyle === ActionOutputStyle.Log
    const compare = outputStyle === ActionOutputStyle.Compare

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
                        showLoading={this.showLoading}
                        onCommand={this.onCommand}
                        onOutput={this.showOutput}
                        onStreamOutput={this.showStreamOutput}
                        onChoices={this.showChoices}
                        />
              </TableCell>
              <TableCell className={classes.outputCell}>
                {loading && <CircularProgress className={classes.loading} />}
                {showBlackBox && <BlackBox output={output} />}
                {(showTable || compare) && 
                    <TableOutput  innerRef={ref => this.tableBox=ref} 
                                  output={output as any[]}
                                  compare={compare} />}
                
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
        {
          showChoices && 
          <ActionChoiceDialog
            open={showChoices}
            title={choiceTitle}
            choices={choices}
            minChoices={minChoices}
            maxChoices={maxChoices}
            onSelection={this.onSelectActionChoice}
            onCancel={this.onCancelActionChoice}
          />
        }
      </div>
    );
  }
}

export default withStyles(styles)(Workspace)