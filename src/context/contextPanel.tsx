import React from 'react'
import { withStyles, createStyles, WithStyles, Theme} from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField';
import Context, {ClusterContext, NamespaceContext} from "./contextStore";
import Button from '@material-ui/core/Button';


import {Cluster, Namespace, Pod, Item} from "../k8s/k8sTypes";

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    flexGrow: 1,
  },
  textfield: {
    width: '40%',
    marginRight: 5,
  },
  textfieldInput: {
    fontSize: '0.8em',
    overflow: 'hidden'
  },
  button: {
    verticalAlign: 'bottom',
    marginBottom: 10
  }
});


interface IState {
}

interface IProps extends WithStyles<typeof styles> {
  useDarkTheme: boolean,
  context: Context,
  onSelectCluster: () => any
}

class ContextPanel extends React.Component<IProps, IState> {
  state: IState = {
  }

  generateClusterSelectionText(cluster: Cluster, context: Context) : string {
    const clusterSelections : string[] = []
    if(cluster) {
      const cc = context.clusterContext(cluster)
      cc && cc.namespaces().forEach(ns => {
        const nsText = "Namespace: " + ns.name
        const nc = cc.namespace(ns)
        if(nc && nc.hasPods()) {
          nc.pods().forEach(pod => {
            const podText = "Pod: " + pod.name + " in " + nsText
            clusterSelections.push(podText)
          })
        } else {
          clusterSelections.push(nsText + " (no pods selected)")
        }
      })
    }
    return clusterSelections.join("\n\n")
  }

  render() {
    const {useDarkTheme, context, classes, onSelectCluster} = this.props;
    const clusters = context.clusters();
    
    const cluster1 = clusters.length > 0 ? clusters[0] : undefined
    const cluster1Selections = cluster1 ?  this.generateClusterSelectionText(cluster1, context) : ""

    const cluster2 = clusters.length > 1 ? clusters[1] : undefined
    const cluster2Selections = cluster2 ? this.generateClusterSelectionText(cluster2, context) : ""

    return (
      <div>
        {cluster1 &&
          <TextField
            label={cluster1 ? "Cluster: " + cluster1.name : ""}
            value={cluster1Selections}
            className={classes.textfield}
            multiline={true}
            rows={3}
            InputProps={{
              readOnly: true,
              classes: {
                input: classes.textfieldInput
              },
            }}
            margin="dense"
            variant="outlined"
          />
        }
        {cluster2 && 
          <TextField
            label={"Cluster: " + cluster2.name}
            value={cluster2Selections}
            className={classes.textfield}
            multiline={true}
            rows={3}
            InputProps={{
              readOnly: true,
              classes: {
                input: classes.textfieldInput
              }
            }}
            margin="dense"
            variant="outlined"
          />
        }
        <Button color="primary" variant="contained" size="small"
              className={classes.button}
              onClick={onSelectCluster}
          >
          {!cluster1 && "Select a Cluster"}
          {cluster1 && "Change Selections"}
        </Button>
      </div>
    );
  }
}

export default withStyles(styles)(ContextPanel);
