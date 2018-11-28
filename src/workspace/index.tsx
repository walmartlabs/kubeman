import React from "react";
import _ from "lodash";
import { withStyles, createStyles, WithStyles, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import Terminal from '../terminal'
import Actions from '../actions/actions'
import ContextPanel from '../context/contextPanel'
import ContextSelector from '../context/contextSelector'
import Context from "../context/contextStore";
import {Cluster, Namespace, Pod, Item} from "../k8s/k8sTypes";

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    backgroundColor: palette.background.default,
    color: palette.primary.main,
  },
  table: {
    verticalAlign: 'top'
  },
  tr: {
    verticalAlign: 'top',
    border: 'none',
  },
  td: {
    verticalAlign: 'top',
    border: 'none',
  },
  button: {
    margin: spacing.unit,
  },
  input: {
    display: 'none',
  },
  bottomRow: {
    height: '50px !important',
    border: 'none',
    padding: 0,
    margin: 0,
  }
});

interface IState {
  context: Context
}

interface IProps extends WithStyles<typeof styles> {
  useDarkTheme: boolean
  onChangeTheme: (boolean) => void
}
interface IRefs {
  [k: string]: any
  terminal: Terminal|undefined
  contextSelector: ContextSelector|undefined
}

export class Workspace extends React.PureComponent<IProps, IState, IRefs> {
  refs: IRefs = {
    terminal: undefined,
    contextSelector: undefined
  }
  state: IState = {
    context: new Context,
  }
  commandHandler?: ((string) => void) = undefined

  registerCommandHandler(commandHandler: (string) => void) {
    this.commandHandler = commandHandler
  }

  onCommand(command: string) {
    this.commandHandler && this.commandHandler(command)
  }

  onUpdateContext = (context: Context) => {
    this.setState({context: context})
    this.forceUpdate()
  }

  onKeyPress(event: KeyboardEvent) {
    const { contextSelector } = this.refs
    contextSelector && contextSelector.onKeyPress(event)
  }

  onSelectCluster() {
    const { contextSelector } = this.refs
    contextSelector && contextSelector.selectClusters()
  }

  render() {
    const { classes, useDarkTheme } = this.props;
    const { context } = this.state;
    
    return (
      <Paper className={classes.root} 
            tabIndex={0}
            //onKeyPress={this.onKeyPress.bind(this)}
      >
        <Table className={classes.table}>
          <TableBody>
            <TableRow className={classes.tr}>
              <TableCell colSpan={2}>
                <ContextPanel context={context} useDarkTheme={useDarkTheme}
                    onUpdateContext={this.onUpdateContext}
                    onSelectContext={this.onSelectCluster.bind(this)} />
              </TableCell>
            </TableRow>
            <TableRow className={classes.tr}>
              <TableCell className={classes.td}>
                <Actions context={context}
                        onCommand={this.onCommand.bind(this)}/>
              </TableCell>
              <TableCell className={classes.td}>
                <Terminal ref='terminal' 
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    width: '80%',
                    height: '80%'
                  }}
                  options={{cols:'60', rows:'40'}}
                  addons={['fit', 'fullscreen', 'search']}
                  connected={true}
                  registerCommandHandler={this.registerCommandHandler.bind(this)}
                />
              </TableCell>
            </TableRow>
            <TableRow className={classes.bottomRow}>
              <TableCell className={classes.bottomRow}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useDarkTheme}
                      onChange={this.props.onChangeTheme}
                      value="Dark"
                    />
                  }
                  label="Dark Theme"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <ContextSelector ref='contextSelector'
            useDarkTheme={useDarkTheme}
            context={context} 
            onUpdateContext={this.onUpdateContext.bind(this)} />
      </Paper>
    );
  }
}

export default withStyles(styles)(Workspace)