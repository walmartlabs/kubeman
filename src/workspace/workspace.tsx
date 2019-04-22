import React from "react";
import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Table, TableBody, TableRow, TableCell, CircularProgress,
      FormControlLabel, Typography, Switch, LinearProgress } from "@material-ui/core";

import StyledActions, {Actions} from '../actions/actions'
import ActionChoiceDialog from '../actions/actionChoiceDialog'
import ActionInfoDialog from '../actions/actionInfoDialog'
import ContextPanel from '../context/contextPanel'
import ContextSelector from '../context/contextSelector'
import Context from "../context/contextStore";
import BlackBox from '../output/blackbox'
import TableOutput, {TableBox} from '../output/tableBox'
import {ActionOutput, ActionOutputStyle, ActionOutputCollector, ActionStreamOutputCollector,
        ActionChoiceMaker, Choice, BoundActionAct, BoundAction} from '../actions/actionSpec'
import ChoiceManager from "../actions/choiceManager"

import styles from './workspace.styles'

interface IState {
  context: Context
  output: ActionOutput|string[]
  outputStyle: ActionOutputStyle
  loading: boolean
  loadingMessage: string
  showActionInitChoices: boolean
  showActionChoices: boolean
  minChoices: number
  maxChoices: number
  choiceTitle: string
  choices: Choice[]
  showChoiceSubItems: boolean
  previousSelections: Choice[]
  showInfo: boolean
  infoTitle: string,
  info: any[]
  scrollMode: boolean
  deferredAction?: BoundActionAct
}

interface IProps extends WithStyles<typeof styles> {
  onChangeTheme: (boolean) => void
}
interface IRefs {
  [k: string]: any
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
    outputStyle: ActionOutputStyle.None,
    loading: false,
    loadingMessage: '',
    showActionInitChoices: false,
    showActionChoices: false,
    minChoices: 0,
    maxChoices: 0,
    choiceTitle: '',
    choices: [],
    showChoiceSubItems: true,
    previousSelections: [],
    showInfo: false,
    infoTitle: '',
    info: [],
    scrollMode: false,
  }
  commandHandler?: ((string) => void) = undefined
  tableBox?: TableBox
  actions?: Actions
  streamOutput: ActionOutput = []

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
  }

  onAction = (action: BoundAction) => {
    this.streamOutput = []
    this.tableBox && this.tableBox.outputManager.clearContent()
    this.setState({scrollMode: false, output: []})
  }

  showOutputLoading = (loading: boolean) => {
    this.tableBox && this.tableBox.showLoading(loading)
  }

  showOutput : ActionOutputCollector = (output, outputStyle) => {
    this.streamOutput = []
    this.setState({
      output,
      outputStyle: outputStyle || ActionOutputStyle.Text, 
      loading: false,
    })
  }

  showStreamOutput : ActionStreamOutputCollector = (output) => {
    this.streamOutput = this.streamOutput.concat(output)
    this.tableBox && this.tableBox.appendOutput(output as ActionOutput)
  }

  setScrollMode = (scrollMode: boolean) => {
    this.setState({scrollMode})
  }

  onActionInitChoices : ActionChoiceMaker = (act, title, choices, minChoices, maxChoices, showChoiceSubItems, previousSelections) => {
    this.streamOutput = []
    this.setState({
      choices,
      minChoices,
      maxChoices,
      choiceTitle: title, 
      showActionInitChoices: true,
      showChoiceSubItems,
      previousSelections,
      deferredAction: act,
      output: [],
      loading: false,
    })
  }

  onActionChoices : ActionChoiceMaker = (react, title, choices, minChoices, maxChoices, showChoiceSubItems, previousSelections) => {
    this.setState({
      choices,
      minChoices,
      maxChoices,
      choiceTitle: title, 
      showActionChoices: true,
      showChoiceSubItems,
      previousSelections,
      deferredAction: react,
      loading: false,
    })
  }

  onSelectActionChoice = (selections: Choice[]) => {
    const {context, deferredAction} = this.state
    context.selections = selections
    this.setState({showActionInitChoices: false, showActionChoices: false, loading: false})
    deferredAction && deferredAction()
  }

  onCancelActionChoice = () => {
    this.setState({showActionInitChoices: false, showActionChoices: false, loading: false})
  }

  showInfo = (infoTitle: string, info: any[]) => {
    this.setState({
      info,
      infoTitle,
      showInfo: true,
      loading: false,
    })
  }

  onInfoOK = () => {
    this.setState({showInfo: false})
  }

  onInfoCancel = () => {
    this.setState({showInfo: false})
  }

  onActionTextInput = (text: string) => {
    this.actions && this.actions.onActionTextInput(text)
  }

  showLoading = (loadingMessage: string) => {
    this.tableBox && this.tableBox.clearFilter()
    this.setState({loading: true, loadingMessage, outputStyle: ActionOutputStyle.None})
  }

  showContextDialog = () => {
    this.refs.contextSelector && this.refs.contextSelector.showContextDialog()
  }

  onUpdateContext = (context: Context) => {
    this.streamOutput = []
    ChoiceManager.clear()
    this.setState({context: context, output: []})
  }

  runAction = (name, ...params) => {
    this.actions && this.actions.runAction(name, ...params)
  }

  render() {
    const { classes } = this.props;
    const { context, output, outputStyle, loading, loadingMessage, scrollMode,
          showActionInitChoices, showActionChoices, minChoices, maxChoices, 
          choiceTitle, choices, showChoiceSubItems, previousSelections,
          showInfo, infoTitle, info } = this.state;

    const showBlackBox = outputStyle === ActionOutputStyle.Text
    const log = outputStyle === ActionOutputStyle.Log || outputStyle === ActionOutputStyle.LogWithHealth
    const health = outputStyle === ActionOutputStyle.TableWithHealth || outputStyle === ActionOutputStyle.LogWithHealth
    const compare = outputStyle === ActionOutputStyle.Compare
    const acceptInput = this.actions ? this.actions.acceptInput() : false
    const allowRefresh = this.actions ? this.actions.allowRefresh() : false
    const accumulatedOutput = (output as any[]).concat(this.streamOutput)
        
    return (
      <div className={classes.root} tabIndex={0}>
        <Table className={classes.table}>
          <TableBody>
            <TableRow className={classes.upperRow}>
              <TableCell colSpan={2} className={classes.contextCell}>
                <ContextPanel context={context} 
                    onUpdateContext={this.onUpdateContext}
                    onSelectContext={this.showContextDialog} 
                    runAction={this.runAction}
                />
              </TableCell>
            </TableRow>
            <TableRow className={classes.lowerRow}>
              <TableCell className={classes.actionCell}>
                <StyledActions innerRef={ref => this.actions=ref}
                        context={context}
                        showLoading={this.showLoading}
                        onOutput={this.showOutput}
                        onStreamOutput={this.showStreamOutput}
                        onActionInitChoices={this.onActionInitChoices}
                        onActionChoices={this.onActionChoices}
                        onShowInfo={this.showInfo}
                        onSetScrollMode={this.setScrollMode}
                        onAction={this.onAction}
                        onOutputLoading={this.showOutputLoading}
                        />
              </TableCell>
              <TableCell className={classes.outputCell}>
                {loading && loadingMessage &&
                  <div>
                    <Typography variant="h5" gutterBottom className={classes.loadingMessage}>
                      {loadingMessage}
                    </Typography>
                    <LinearProgress className={classes.loadingLinear} />
                  </div>
                }
                {loading && !loadingMessage &&
                  <CircularProgress className={classes.loadingCircular} />
                }
                {showBlackBox && <BlackBox output={output} />}
                {!showBlackBox && 
                    <TableOutput  innerRef={ref => this.tableBox=ref}
                                  output={accumulatedOutput}
                                  compare={compare} 
                                  log={log}
                                  health={health}
                                  acceptInput={acceptInput}
                                  allowRefresh={allowRefresh}
                                  scrollMode={scrollMode}
                                  onActionTextInput={this.onActionTextInput}
                    />
                }
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
                <div className={classes.statusMessage}>
                  {context.errorMessage}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <ContextSelector ref='contextSelector'
            context={context} 
            onUpdateContext={this.onUpdateContext.bind(this)} />
        {
          (showActionInitChoices || showActionChoices) && 
          <ActionChoiceDialog
            open={showActionInitChoices || showActionChoices}
            title={choiceTitle}
            choices={choices}
            minChoices={minChoices}
            maxChoices={maxChoices}
            showChoiceSubItems={showChoiceSubItems}
            previousSelections={previousSelections}
            onSelection={this.onSelectActionChoice}
            onCancel={this.onCancelActionChoice}
          />
        }
        {
          showInfo && 
          <ActionInfoDialog
            open={showInfo}
            title={infoTitle}
            items={info}
            onOK={this.onInfoOK}
            onCancel={this.onInfoCancel}
          />
        }
      </div>
    );
  }
}

export default withStyles(styles)(Workspace)