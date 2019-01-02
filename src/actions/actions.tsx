import fs from 'fs'
import path from 'path'

import React from "react";
import { withStyles, WithStyles, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

import Context from "../context/contextStore";
import {ActionLoader} from './actionLoader'

import {ActionGroupSpecs, ActionSpec, BoundAction, ActionGroupSpec, ActionContextType,
        ActionOutputCollector, ActionStreamOutputCollector, ActionChoiceMaker} from './actionSpec'

import styles from './actions.styles'
import {actionsTheme} from '../theme/theme'

const actionPluginFolder = "plugins"

interface IState {
  actionGroupSpecs: ActionGroupSpecs,
  selectedAction?: BoundAction,
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  showLoading: () => void
  onCommand: (string) => void
  onOutput: ActionOutputCollector
  onStreamOutput: ActionStreamOutputCollector
  onChoices: ActionChoiceMaker
}

export class Actions extends React.Component<IProps, IState> {
  state: IState = {
    actionGroupSpecs: [],
    selectedAction: undefined,
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
    this.loadActionPlugins()
  }

  componentWillReceiveProps(props: IProps) {
    const {context} = props
    ActionLoader.setOnOutput(props.onOutput, props.onStreamOutput)
    ActionLoader.setOnChoices(props.onChoices)
    ActionLoader.setContext(context)
  }

  loadActionPlugins() {
    ActionLoader.setOnLoad(actionGroupSpecs => this.setState({actionGroupSpecs}))
    ActionLoader.loadActionPlugins()
  }

  clear = () => {
    this.props.onCommand && this.props.onCommand("clear")
  }

  onAction = (action: BoundAction) => {
    const {selectedAction: prevAction} = this.state
    prevAction && prevAction.stop && prevAction.stop()
    ActionLoader.actionContext.inputText = undefined
    this.setState({selectedAction: action})
    if(action.act) {
      this.props.showLoading()
      action.act()
    }
  }

  acceptInput() : boolean {
    const {selectedAction} = this.state
    return selectedAction && selectedAction.react ? true : false
  }

  onActionTextInput = (text: string) => {
    const {selectedAction: action} = this.state
    if(action && action.react) {
      ActionLoader.actionContext.inputText = text
      action.react()
    }
  }

  renderExpansionPanel(actionGroupSpec: ActionGroupSpec) {
    const { classes } = this.props;
    const {selectedAction} = this.state
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
              className={selectedAction && action.name === selectedAction.name 
                          && action.context === selectedAction.context ? classes.selectedAction : ''}>
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
    const {actionGroupSpecs} = this.state
    const useDarkTheme = global['useDarkTheme']
    const theme = createMuiTheme(actionsTheme.getTheme(useDarkTheme));

    const actionShowNoShow : Map<ActionContextType, boolean> = new Map
    actionShowNoShow.set(ActionContextType.Common, true)
    actionShowNoShow.set(ActionContextType.Cluster, context.hasClusters)
    actionShowNoShow.set(ActionContextType.Namespace, context.hasNamespaces)
    actionShowNoShow.set(ActionContextType.Pod, context.hasPods)
    actionShowNoShow.set(ActionContextType.Istio, context.hasClusters)
    actionShowNoShow.set(ActionContextType.Other, context.hasClusters)

    return (
      <MuiThemeProvider theme={theme}>
        {actionGroupSpecs.map(actionGroupSpec => 
          actionShowNoShow.get(actionGroupSpec.context || ActionContextType.Other) &&
            this.renderExpansionPanel(actionGroupSpec)
        )}
      </MuiThemeProvider>  
    )
  }
}
export default withStyles(styles)(Actions)