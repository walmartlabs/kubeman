import React from "react";
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

import styles from './actions.styles'

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  onCommand?: (string) => void
}

class ClusterActions extends React.Component<IProps, IState> {


  getNamespaces = () => {
    this.props.onCommand && this.props.onCommand("kubectl get ns")
  }

  getIstioPods = () => {
    this.props.onCommand && this.props.onCommand("kubectl get pods -n istio-system")
  }

  grepIstioLogsFor503 = () => {
    this.props.onCommand && this.props.onCommand('kubectl logs -n istio-system $(kubectl get po -l istio=ingressgateway -n istio-system -o jsonpath="{.items[0]..metadata.name}") -c istio-proxy | grep "HTTP/1.1.*503 -"')
  }

  render() {
    const { context, classes } = this.props;
    return context.hasClusters() ?
    <div className={classes.expansion}>
       <ExpansionPanel className={classes.expansion}>
         <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
           <Typography>Cluster Actions</Typography>
         </ExpansionPanelSummary>
         <ExpansionPanelDetails className={classes.expansionDetails}>
           <List component="nav">
             <ListItem button>
               <ListItemText className={classes.listText}
                     onClick={this.getNamespaces}>
                 <Typography>List Namespaces</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText 
                     onClick={this.getIstioPods}>
                 <Typography>Get Istio Pods</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText
                     onClick={this.grepIstioLogsFor503}>
                 <Typography>Check Ingress Logs for HTTP 503</Typography>
               </ListItemText>
             </ListItem>
           </List>
         </ExpansionPanelDetails>
       </ExpansionPanel>
     </div>
     : <div/>
  }
  
}

export default withStyles(styles)(ClusterActions)