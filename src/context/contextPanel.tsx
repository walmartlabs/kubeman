import React from 'react'
import _ from 'lodash'

import { withStyles, WithStyles, createStyles, withTheme, WithTheme, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { Paper, Tabs, Tab, Grid, Button } from '@material-ui/core';
import List from '@material-ui/core/List';
import ListSubheader from '@material-ui/core/ListSubheader';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

import {Cluster, Namespace, Pod, Item} from "../k8s/k8sTypes";
import Context from "./contextStore";

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    overflow: 'hidden',
    backgroundColor: palette.background.paper,
  },
  list: {
    maxHeight: 200,
    backgroundColor: palette.background.paper,
    overflow: 'auto',
    boxShadow: '0px 1px 5px 0px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 3px 1px -2px rgba(0, 0, 0, 0.12)',
  },
  listHeader: {
    padding: 0,
    paddingLeft: 5,
    backgroundColor: '#4b6082',
    color: 'white',
    lineHeight: 2,
  },
  listItem: {
    paddingLeft: 5,
  },
  listInfoText: {
    fontSize: '0.9em',
    marginRight: 5,
    float: 'right',
  },
  panel: {
    maxHeight: 300, 
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  grid: {
    height: 200,
  },
  gridItem: {
    minWidth: 250,
  },
  tabsRoot: {
    borderBottom: '1px solid #e8e8e8',
  },
  tabsIndicator: {
    backgroundColor: '#1890ff',
  },
  tabRoot: {
    textTransform: 'initial',
    minWidth: 72,
    fontWeight: typography.fontWeightRegular,
    marginRight: spacing.unit * 4,
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    '&:hover': {
      color: '#40a9ff',
      opacity: 1,
    },
    '&$tabSelected': {
      color: '#1890ff',
      fontWeight: typography.fontWeightMedium,
    },
    '&:focus': {
      color: '#40a9ff',
    },
  },
  tabSelected: {},
  tabButton: {
    background: 'linear-gradient(45deg, #1890ff 40%, #0656d8 95%)',
  },
});


interface IState {
  context: Context
  activeTab: number
}

interface IProps extends WithStyles<typeof styles> {
  useDarkTheme: boolean,
  context: Context,
  onUpdateContext: (Context) => void
  onSelectContext: () => void
}

class ContextPanel extends React.Component<IProps, IState> {
  state: IState = {
    context: new Context,
    activeTab: 0,
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: IProps) {
    const {context} = props;
    //this.createTestData(context)
  }

  onTabChange = (event, value) => {
    if(value !== 2) {
      this.setState({ activeTab: value });
    }
  };

  renderNamespace = (namespace: Namespace) => {
    const {classes, context} = this.props
    const pods = context.podsForNamespace(namespace)

    return (
      <List dense 
        className={classes.list}
        subheader={
          <ListSubheader classes={{root: classes.listHeader}}>
            Namespace: {namespace.name}
            <span className={classes.listInfoText}>{pods.length} Pod(s)</span>
          </ListSubheader>
        }>
        {pods.map((pod, index) => (
          <ListItem key={index} role={undefined} 
              dense disableGutters divider
              className={classes.listItem}>
            <ListItemText primary={pod.name} />
          </ListItem>
        ))}
      </List>
    )
  }

  render() {
    const {classes, context, onSelectContext} = this.props;
    const {activeTab} = this.state
    const clusters = context.clusters();

    return (
      <div>
        <Tabs 
            value={activeTab}
            onChange={this.onTabChange}
            classes={{ root: classes.tabsRoot, indicator: classes.tabsIndicator }}
          >
          {
            clusters.map((cluster, index) => 
              <Tab key={cluster.name+index}
              disableRipple
              classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
              label={cluster.name}
              />
            )
          }
          <Tab label={context.hasClusters() ? "Change Selections" : "Select a Cluster"} 
              classes={{labelContainer: classes.tabButton}}
              onClick={onSelectContext} />
        </Tabs>
        {
        <Paper className={classes.panel}>
          <Grid container direction='column' spacing={8}
                className={classes.grid}  >
          {      
            clusters.map((cluster, index) => {
              if(activeTab === index) {
                const namespaces = context.namespacesForCluster(cluster)
                return namespaces && namespaces.map(namespace => 
                    <Grid key={namespace.name+index} item xs={12} md={12} className={classes.gridItem}>
                      {this.renderNamespace(namespace)}
                    </Grid>
                )
              } else {
                return ""
              }
            })
          }
          </Grid>  
        </Paper>
        } 
      </div>
    )
  }
}

export default withStyles(styles)(ContextPanel);
