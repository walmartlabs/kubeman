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

import {ActionOutput, ActionOutputStyle, ActionGroupSpecs, ActionSpec, ActionGroupSpec} from './actionSpec'

import styles from './actions.styles'
import {actionsTheme} from '../theme/theme'

const actionPluginFolder = "plugins"

interface IState {
  actionGroupSpecs: ActionGroupSpecs,
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  showLoading: () => void
  onCommand: (string) => void
  onOutput: (ActionOutput, ActionOutputStyle) => void
}

class Actions extends React.Component<IProps, IState> {
  state: IState = {
    actionGroupSpecs: [],
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
    this.loadActionPlugins()
  }

  componentWillReceiveProps(props: IProps) {
    const {context} = props
    ActionLoader.setOnOutput(props.onOutput)
    ActionLoader.setContext(context)
  }

  loadActionPlugins() {
    ActionLoader.setOnLoad(actionGroupSpecs => this.setState({actionGroupSpecs}))
    ActionLoader.loadActionPlugins()
  }

  clear = () => {
    this.props.onCommand && this.props.onCommand("clear")
  }

  onAction = (actionContext: string, action: ActionSpec) => {
    if(action.act) {
      this.props.showLoading()
      action.act()
    }
  }

  renderExpansionPanel(actionGroupSpec: ActionGroupSpec) {
    const { classes } = this.props;
    const {context, actions} = actionGroupSpec


    return (
      <ExpansionPanel key={context} className={classes.expansion}>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
          <Typography>{context} Actions</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails className={classes.expansionDetails}>
          <List component="nav">
            {actions.map(action => 
              <ListItem key={action.name} button disableGutters>
                <ListItemText className={classes.listText}
                      onClick={this.onAction.bind(this, context, action)}>
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

    return (
      <MuiThemeProvider theme={theme}>
        {actionGroupSpecs.map(actionGroupSpec => 
          this.renderExpansionPanel(actionGroupSpec)
        )}
      </MuiThemeProvider>  
    )
  }
}
export default withStyles(styles)(Actions)