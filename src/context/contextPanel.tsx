import React from 'react'
import _ from 'lodash'

import { withStyles, WithStyles } from '@material-ui/core/styles'
import { Paper, Tabs, Tab, Grid, TextField } from '@material-ui/core';
import {List, ListSubheader, ListItem, ListItemText}  from '@material-ui/core';
import {Avatar, Chip, Card, CardContent } from '@material-ui/core';

import {Cluster, Namespace, Pod, Item} from "../k8s/k8sObjectTypes";
import Context from "./contextStore";

import styles from './contextPanel.styles'

interface IState {
  context: Context
  activeTab: number
}

interface IProps extends WithStyles<typeof styles> {
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
    const {activeTab} = this.state
    const clusters = context.clusters
    if(activeTab >= clusters.length) {
      this.setState({ activeTab: 0});
    }
  }

  onTabChange = (event, value) => {
    const {context} = this.props;
    
    if(value !== context.clusters.length) {
      this.setState({ activeTab: value });
    }
  };

  renderNamespaceWithPods = (namespace: Namespace) => {
    const {classes, context} = this.props
    const pods = namespace.pods

    return (
      <List dense 
        className={classes.list}
        subheader={
          <ListSubheader classes={{root: classes.listHeader}}>
            <span className={classes.listHeader}>{namespace.name}</span>
            <span className={classes.listInfoText}>{pods.length} Pod(s) selected</span>
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

  renderNamespace = (namespace: Namespace) => {
    const {classes, context} = this.props
    return (
      <Chip label={namespace.name}
            avatar={<Avatar>NS</Avatar>} 
            color="primary"
      />
    )
  }

  render() {
    const {classes, context, onSelectContext} = this.props;
    const {activeTab} = this.state
    const clusters = context.clusters

    return (
      <div>
        <Tabs 
            value={activeTab}
            onChange={this.onTabChange}
            classes={{ root: classes.tabsRoot, indicator: classes.tabsIndicator }}
            variant="scrollable"
            scrollButtons="auto"
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
          <Tab label={context.hasClusters ? "Update Context" : "Select Cluster"} 
              classes={{labelContainer: classes.tabButton}}
              onClick={onSelectContext} />
        </Tabs>
        {
        <Paper className={classes.panel}>
          <Grid container direction='column' spacing={8} justify="flex-start" alignItems="center"
                className={classes.grid} >
          {
            clusters.length > 0 &&
              clusters.map((cluster, index) => {
                if(activeTab === index) {
                  if(cluster.namespaces.length > 0) {
                    return cluster.namespaces.map(namespace => 
                        <Grid key={namespace.name+index} item xs={12} md={12} className={classes.gridItem}>
                          {this.renderNamespace(namespace)}
                        </Grid>)
                  } else {
                    return <TextField key={cluster.name+"nons"} 
                                      disabled
                                      variant="outlined"
                                      style={{width: '100%', border: 0}}
                                      defaultValue="No namespaces selected" />
                  }
                } else {
                  return ""
                }
              })
          }
          {
            clusters.length === 0 && 
              <Grid item xs={12} md={12} className={classes.gridItem}>
                <Card className={classes.card}>
                  <CardContent>
                    Select clusters, namespaces and pods to build the context to work with.
                  </CardContent>
                </Card>
              </Grid>

          }
          </Grid>  
        </Paper>
        } 
      </div>
    )
  }
}

export default withStyles(styles)(ContextPanel);
