import React from "react";
import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import {ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails} from '@material-ui/core';
import {Typography, List, ListItem, ListItemText, InputBase,
        FormGroup, FormControlLabel, Checkbox} from '@material-ui/core';

import Context from "../context/contextStore";
import {ActionLoader} from './actionLoader'

import {ActionGroupSpecs, ActionSpec, BoundAction, ActionGroupSpec, ActionContextType,
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker, ActionOnInfo} from './actionSpec'

import styles from './actions.styles'
import {actionsTheme} from '../theme/theme'


interface IState {
  actionGroupSpecs: ActionGroupSpecs
  autoRefresh: boolean
  invalidAutoRefreshDelay: boolean
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  showLoading: (string) => void
  onOutput: ActionOutputCollector
  onStreamOutput: ActionStreamOutputCollector
  onActionInitChoices: ActionChoiceMaker
  onActionChoices: ActionChoiceMaker
  onShowInfo: ActionOnInfo
  onSetScrollMode: (boolean) => void
  onAction: (BoundAction) => void
  onOutputLoading: (boolean) => void
}

export class Actions extends React.Component<IProps, IState> {
  state: IState = {
    actionGroupSpecs: [],
    autoRefresh: false,
    invalidAutoRefreshDelay: false,
  }
  currentAction?: BoundAction
  refreshTimer: any
  refreshChangeTimer: any
  lastRefreshed: any

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
    this.loadActionPlugins()
  }

  componentWillReceiveProps(props: IProps) {
    const {context} = props
    ActionLoader.setOnOutput(props.onOutput, props.onStreamOutput)
    ActionLoader.setOnActionChoices(props.onActionInitChoices, props.onActionChoices)
    ActionLoader.setOnShowInfo(props.onShowInfo)
    ActionLoader.setContext(context)
    ActionLoader.setOnSetScrollMode(props.onSetScrollMode)
    ActionLoader.setOnOutputLoading(props.onOutputLoading)
  }

  loadActionPlugins() {
    ActionLoader.setOnLoad(actionGroupSpecs => this.setState({actionGroupSpecs}))
    ActionLoader.loadActionPlugins()
  }

  onAction = (action: BoundAction) => {
    this.props.onAction(action)
    const prevAction = this.currentAction
    prevAction && prevAction.stop && prevAction.stop()
    ActionLoader.actionContext.inputText = undefined
    this.currentAction = action
    this.lastRefreshed = undefined
    if(action.act) {
      this.props.showLoading(action.loadingMessage)
      action.chooseAndAct()
      this.setAutoRefresh(false)
    }
  }

  cancelRefreshTimers() {
    if(this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    if(this.refreshChangeTimer) {
      clearTimeout(this.refreshChangeTimer)
      this.refreshChangeTimer = undefined
    }
  }

  setAutoRefresh(autoRefresh: boolean) {
    this.cancelRefreshTimers()
    if(autoRefresh && this.currentAction && this.currentAction.refresh) {
      this.refreshTimer = setInterval(() => {
        this.lastRefreshed = new Date()
        this.currentAction && this.currentAction.refresh && this.currentAction.refresh()
      }, 
      this.currentAction.autoRefreshDelay ? this.currentAction.autoRefreshDelay * 1000 : 15000)
    }
    this.setState({autoRefresh})
  }

  onAutoRefresh = (event) => {
    this.setAutoRefresh(event.target.checked)
  }

  onAutoRefreshChange = (event) => {
    this.cancelRefreshTimers()
    if(this.currentAction && this.currentAction.autoRefreshDelay) {
      const prev = this.currentAction.autoRefreshDelay
      try {
        let newVal = Number.parseInt(event.target.value)
        if(newVal >= 5) {
          this.setState({invalidAutoRefreshDelay: false})
          this.currentAction.autoRefreshDelay = newVal
          if(this.state.autoRefresh) {
            this.refreshChangeTimer = setTimeout(this.setAutoRefresh.bind(this, this.state.autoRefresh), 500)
          }
        } else {
          this.setState({invalidAutoRefreshDelay: true})
        }
      } catch(error) {
        this.setState({invalidAutoRefreshDelay: true})
        this.currentAction.autoRefreshDelay = prev
      }
    }
  }

  acceptInput() : boolean {
    return this.currentAction && this.currentAction.react ? true : false
  }

  onActionTextInput = (text: string) => {
    if(this.currentAction && this.currentAction.react) {
      ActionLoader.actionContext.inputText = text
      this.currentAction.react()
    }
  }

  renderExpansionPanel(actionGroupSpec: ActionGroupSpec) {
    const { classes } = this.props;
    const {title, actions} = actionGroupSpec


    return (
      <ExpansionPanel key={title} className={classes.expansion}>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
          <Typography>{title}</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails className={classes.expansionDetails}>
          <List component="nav">
            {actions.map(action => 
              <ListItem key={action.name} button disableGutters
              className={this.currentAction && action.name === this.currentAction.name 
                          && action.context === this.currentAction.context ? classes.selectedAction : ''}>
                <ListItemText className={classes.listText}
                      onClick={this.onAction.bind(this, action as BoundAction)}>
                  <Typography>{action.name}</Typography>
                </ListItemText>
              </ListItem>
          )}
          </List>
        </ExpansionPanelDetails>
      </ExpansionPanel>
    )
  }

  render() {
    const { context, classes } = this.props;
    const {actionGroupSpecs, invalidAutoRefreshDelay} = this.state
    const useDarkTheme = global['useDarkTheme']
    const theme = createMuiTheme(actionsTheme.getTheme(useDarkTheme));

    const actionShowNoShow : Map<ActionContextType, boolean> = new Map
    actionShowNoShow.set(ActionContextType.Cluster, context.hasClusters)
    actionShowNoShow.set(ActionContextType.Namespace, context.hasClusters)
    actionShowNoShow.set(ActionContextType.Istio, context.hasClusters)
    actionShowNoShow.set(ActionContextType.Other, context.hasClusters)

    return (
      <MuiThemeProvider theme={theme}>
        {actionGroupSpecs.map(actionGroupSpec => 
          actionShowNoShow.get(actionGroupSpec.context || ActionContextType.Other) &&
            this.renderExpansionPanel(actionGroupSpec)
        )}
        {this.currentAction && this.currentAction.refresh &&
          <div>
            <FormGroup row>
              <FormControlLabel control={
                  <Checkbox
                    checked={this.state.autoRefresh}
                    onChange={this.onAutoRefresh}
                  />
                }
                label={"Auto Refresh: "}
              />
              <InputBase 
                defaultValue={this.currentAction.autoRefreshDelay}
                inputProps={{size: 2, maxLength: 2,}}
                classes={{
                  root: classes.refreshRoot,
                  input: classes.refreshInput + " " + (invalidAutoRefreshDelay ? classes.invalidRefreshInput: "")
                }}
                onChange={this.onAutoRefreshChange}
              />
            </FormGroup>
            <Typography style={{paddingTop: 0, paddingLeft: 35}}>
              Last Refreshed: {this.lastRefreshed ? this.lastRefreshed.toISOString() : 'None'}
            </Typography>
          </div>
        }
      </MuiThemeProvider>  
    )
  }
}
export default withStyles(styles)(Actions)