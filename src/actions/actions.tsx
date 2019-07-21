/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import React, { ChangeEvent } from "react";
import _ from 'lodash'
import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import {ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails,
        Typography, List, ListItem, ListItemText, InputBase, Input, Paper,
        FormGroup, FormControlLabel, Checkbox, Button} from '@material-ui/core';

import Context from "../context/contextStore";
import {ActionLoader} from './actionLoader'

import {ActionGroupSpecs, ActionSpec, BoundAction, ActionGroupSpec, ActionContextType,
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker, ActionOnInfo} from './actionSpec'

import styles from './actions.styles'
import {actionsTheme} from '../theme/theme'
import FilterUtil, {filter} from '../util/filterUtil'


interface IState {
  actionGroupSpecs: ActionGroupSpecs
  filteredActions: ActionSpec[],
  autoRefresh: boolean
  invalidAutoRefreshDelay: boolean
}

interface IProps extends WithStyles<typeof styles> {
  showLoading: (string) => void
  onOutput: ActionOutputCollector
  onStreamOutput: ActionStreamOutputCollector
  onActionInitChoices: ActionChoiceMaker
  onActionChoices: ActionChoiceMaker
  onCancelActionChoice: () => void
  onShowInfo: ActionOnInfo
  onSetColumnWidths: (...widths) => void
  onSetScrollMode: (boolean) => void
  onAction: (BoundAction) => void
  onOutputLoading: (boolean) => void
}

export class Actions extends React.Component<IProps, IState> {
  state: IState = {
    actionGroupSpecs: [],
    filteredActions: [],
    autoRefresh: false,
    invalidAutoRefreshDelay: false,
  }
  currentAction?: BoundAction
  refreshTimer: any
  refreshChangeTimer: any
  lastRefreshed: any
  filterText: string = ''
  clickAllowed: boolean = true

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
    this.loadActionPlugins()
  }

  componentWillReceiveProps(props: IProps) {
    ActionLoader.setOnOutput(props.onOutput, props.onStreamOutput)
    ActionLoader.setOnActionChoices(props.onActionInitChoices, props.onActionChoices, props.onCancelActionChoice)
    ActionLoader.setOnShowInfo(props.onShowInfo)
    ActionLoader.setOnSetColumnWidths(props.onSetColumnWidths)
    ActionLoader.setOnOutputLoading(props.onOutputLoading)
  }

  loadActionPlugins() {
    ActionLoader.setOnLoad(actionGroupSpecs => this.setState({actionGroupSpecs}))
    ActionLoader.loadActionPlugins()
  }

  runAction(name, ...params) {
    const {actionGroupSpecs} = this.state
    const action = _.flatten(actionGroupSpecs.map(spec => spec.actions))
                      .filter(action => action.name === name)[0]
    action && this.onRunAction(action, true, ...params)
  }


  onRunAction = (action: BoundAction, direct: boolean, ...params) => {
    if(!this.clickAllowed) return
    this.throttleClick()
    this.props.onAction(action)
    const prevAction = this.currentAction
    prevAction && prevAction.stop && prevAction.stop()
    ActionLoader.actionContext.inputText = undefined
    this.currentAction = action
    this.lastRefreshed = undefined
    if(direct && action.directAct) {
      action.directAct(params)
      this.setAutoRefresh(false)
    } else if(action.act) {
      action.loadingMessage && this.props.showLoading(action.loadingMessage)
      action.chooseAndAct()
      this.setAutoRefresh(false)
    }
  }

  onAction = (action: BoundAction) => {
    this.onRunAction(action, false)
  }

  throttleClick() {
    this.clickAllowed = false
    setTimeout(() => this.clickAllowed = true, 1000)
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

  onReRun = () => {
    if(this.currentAction) {
      if(this.currentAction.canReact) {
        this.currentAction.react && this.currentAction.react()
      } else if(this.currentAction.refresh) {
        this.currentAction.refresh()
      } else {
        this.currentAction.chooseAndAct()
      }
    }
  }

  onClearOutput = () => {
    this.currentAction && this.currentAction.clear && this.currentAction.clear()
  }

  onStopAction = () => {
    this.currentAction && this.currentAction.stop && this.currentAction.stop()
  }

  onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {actionGroupSpecs} = this.state
    let text = event.target.value
    if(text && text.length > 0) {
      this.filterText = text
      if(text.length > 1) {
        const actions = _.flatten(actionGroupSpecs.map(group => group.actions))
        const filteredActions = FilterUtil.filter(text, actions, "name")
        this.setState({filteredActions})
      }
    } else {
      this.clearFilter()
    }
    this.forceUpdate()
  }

  clearFilter() {
    this.filterText = ''
    this.setState({filteredActions: []})
  }

  onKeyDown = (event) => {
    if(event.which === 27 /*Esc*/) {
      this.clearFilter()
    }
  }


  renderExpansionPanel(title: string, actions: ActionSpec[], expanded: boolean = false) {
    const { classes } = this.props;
    return (
      <ExpansionPanel key={title} className={classes.expansion} defaultExpanded={expanded}>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
          <Typography>{title}</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails className={classes.expansionDetails}>
          <List component="nav">
            {actions.map(action => 
              <ListItem key={action.name} button disableGutters
              className={this.currentAction && action.name === this.currentAction.name 
                          && action.context === this.currentAction.context ? classes.selectedMenuItem : classes.menuItem}>
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
    const { classes } = this.props;
    const {actionGroupSpecs, invalidAutoRefreshDelay, filteredActions} = this.state
    const useDarkTheme = global['useDarkTheme']
    const theme = createMuiTheme(actionsTheme.getTheme(useDarkTheme));

    const actionShowNoShow : Map<ActionContextType, boolean> = new Map
    actionShowNoShow.set(ActionContextType.Cluster, Context.hasClusters)
    actionShowNoShow.set(ActionContextType.Namespace, Context.hasClusters)
    actionShowNoShow.set(ActionContextType.Istio, Context.hasIstio)
    actionShowNoShow.set(ActionContextType.Other, true)

    return (
      <MuiThemeProvider theme={theme}>
        {Context.hasClusters &&
          <Paper  className={classes.filterContainer}>
            <Input fullWidth autoFocus
                placeholder="Type here to find Recipes" 
                value={this.filterText}
                onChange={this.onFilterChange}
                onKeyDown={this.onKeyDown}
                className={classes.filterInput}
            />
          </Paper>
        }
        <div className={classes.root}>
          {filteredActions.length > 0 && 
            this.renderExpansionPanel("Matching Recipes", filteredActions, true)
          }
          {actionGroupSpecs.map(actionGroupSpec => 
            actionShowNoShow.get(actionGroupSpec.context || ActionContextType.Other) &&
              this.renderExpansionPanel(actionGroupSpec.title||"", actionGroupSpec.actions)
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
          {this.currentAction && this.currentAction.clear && 
            <Button color="primary" variant="contained" size="small"
                  className={classes.actionButton}
                  onClick={this.onClearOutput}
              >
              Clear
            </Button>
          }
          {this.currentAction && this.currentAction.stop && 
            <Button color="primary" variant="contained" size="small"
                  className={classes.actionButton}
                  onClick={this.onStopAction}
              >
              Stop
            </Button>
          }
          {this.currentAction && 
            (this.currentAction.canReact || this.currentAction.refresh) &&
            <Button color="primary" variant="contained" size="small"
                  className={classes.actionButton}
                  onClick={this.onReRun}
              >
              ReRun
            </Button>
          }
        </div>
      </MuiThemeProvider>  
    )
  }
}
export default withStyles(styles)(Actions)