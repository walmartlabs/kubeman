import React from "react";
import _ from 'lodash'
import { withStyles, WithStyles } from '@material-ui/core/styles'
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

import Context from "../context/contextStore";
import * as k8s from '../k8s/k8sClient'

import styles from './actions.styles'

type ActionOutput = string[][]

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  onCommand: (string) => void
  onOutput: (ActionOutput) => void
}

class NamespaceActions extends React.Component<IProps, IState> {

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
  }

  isSidecarInjectionEnabled = () => {

  }

  getNamespaceCreationTime = () => {

  }

  getNamespaceLastModifiedTime = () => {

  }

  listServices = () => {

  }


  getPodStatuses = () => {
    const { context, onOutput } = this.props;
    let output: string[][] = []
    Promise.all(context.namespaces().map(namespace => k8s.getPodsForNamespace(namespace)))
      .then(results => {
        _.flatten(results).forEach(pod => {
        })
        onOutput && onOutput(output)
      })
  }

  render() {
    const { context, classes } = this.props;

    return context.hasNamespaces() ?
    <div className={classes.expansion}>
       <ExpansionPanel className={classes.expansion}>
         <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
           <Typography>Namespace Actions</Typography>
         </ExpansionPanelSummary>
         <ExpansionPanelDetails className={classes.expansionDetails}>
           <List component="nav">
             <ListItem button>
               <ListItemText className={classes.listText}
                     onClick={this.isSidecarInjectionEnabled}>
                 <Typography>Is Sidecar Injection Enabled?</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText className={classes.listText}
                     onClick={this.getNamespaceCreationTime}>
                 <Typography>Get Creation Time</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText 
                     onClick={this.getNamespaceLastModifiedTime}>
                 <Typography>Get Last Modified Time</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText
                     onClick={this.listServices}>
                 <Typography>List Services</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText
                     onClick={this.getPodStatuses}>
                 <Typography>Get Pod Statuses</Typography>
               </ListItemText>
             </ListItem>
           </List>
         </ExpansionPanelDetails>
       </ExpansionPanel>
     </div>
     : <div/>
  }
  
}

export default withStyles(styles)(NamespaceActions)