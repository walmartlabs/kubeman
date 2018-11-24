import React from "react";
import { withStyles, WithStyles, createStyles, Theme } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import expansionClosedColor from '@material-ui/core/colors/blueGrey';
import expansionOpenColor from '@material-ui/core/colors/blue';


import Context from "../context/contextStore";

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  expansion: {
    width: '200px',
  },
  expansionHead: {
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
  },
  expansionDetails: {
    display: 'block',
  },
  listText: {
    fontSize: typography.pxToRem(10),
  },
});

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  onCommand?: (string) => void
}

class NamespaceActions extends React.Component<IProps, IState> {

  isSidecarInjectionEnabled() {

  }

  getNamespaceCreationTime() {

  }

  getNamespaceLastModifiedTime() {

  }

  listServices() {

  }

  render() {
    const { context, classes } = this.props;
    return context.hasNamespaces() ?
    <div>
       <ExpansionPanel className={classes.expansion}>
         <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
           <Typography>Namespace Actions</Typography>
         </ExpansionPanelSummary>
         <ExpansionPanelDetails className={classes.expansionDetails}>
           <List component="nav">
             <ListItem button>
               <ListItemText className={classes.listText}
                     onClick={this.isSidecarInjectionEnabled.bind(this)}>
                 <Typography>Is Sidecar Injection Enabled?</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText className={classes.listText}
                     onClick={this.getNamespaceCreationTime.bind(this)}>
                 <Typography>Get Creation Time</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText 
                     onClick={this.getNamespaceLastModifiedTime.bind(this)}>
                 <Typography>Get Last Modified Time</Typography>
               </ListItemText>
             </ListItem>
           </List>
           <List component="nav">
             <ListItem button>
               <ListItemText
                     onClick={this.listServices.bind(this)}>
                 <Typography>List Services</Typography>
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