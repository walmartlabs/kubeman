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

import Context from "../context/contextStore";
import ClusterActions from './clusterActions'
import NamespaceActions from './namespaceActions'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    padding: spacing.unit,
    backgroundColor: palette.background.default,
    color: palette.primary.main,
  },
  button: {
    margin: spacing.unit,
  },
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
  }
});

interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  context: Context,
  onCommand?: (string) => void
}

class Actions extends React.PureComponent<IProps, IState> {

  clear() {
    this.props.onCommand && this.props.onCommand("clear")
  }

  getNamespaces() {
    this.props.onCommand && this.props.onCommand("kubectl get ns")
  }

  getIstioPods() {
    this.props.onCommand && this.props.onCommand("kubectl get pods -n istio-system")
  }

  grepIstioLogsFor503() {
    this.props.onCommand && this.props.onCommand('kubectl logs -n istio-system $(kubectl get po -l istio=ingressgateway -n istio-system -o jsonpath="{.items[0]..metadata.name}") -c istio-proxy | grep "HTTP/1.1.*503 -"')
  }

  commonActions() {
    const { context, classes } = this.props;
    return <ExpansionPanel className={classes.expansion}>
      <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} className={classes.expansionHead}>
        <Typography>Common Actions</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails className={classes.expansionDetails}>
        <List component="nav">
          <ListItem button>
            <ListItemText className={classes.listText}
                  onClick={this.clear.bind(this)}>
              <Typography>Clear</Typography>
            </ListItemText>
          </ListItem>
        </List>
      </ExpansionPanelDetails>
    </ExpansionPanel>
}

  render() {
    const { context, classes } = this.props;
    return (
      <div>
        {this.commonActions()}
        <ClusterActions context={context} onCommand={this.props.onCommand}/>
        <NamespaceActions context={context} onCommand={this.props.onCommand}/>
      </div>
    )
  }
}
export default withStyles(styles)(Actions)