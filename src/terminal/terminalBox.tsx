import React from "react";
import Terminal from '.'

interface IProps {
  output: string
}
interface IState {
}
interface IRefs {
  [k: string]: any
  terminal: Terminal|undefined
}
export default class TerminalBox extends React.Component<IProps, IState> {
  refs: IRefs = {
    terminal: undefined,
  }
  state: IState = {
  }

  componentWillReceiveProps(props: IProps) {
  }

  write(output: string) {
    const {terminal} = this.refs
    if(terminal) {
      terminal.clear()
      terminal.write(output)
    }
  }

  render() {
    return (
      <Terminal ref='terminal'
      style={{
        overflow: 'hidden',
        position: 'relative',
      }}
      options={{cols:'100', rows:'4'}}
      output={this.props.output}
      connected={false}
    />
    )
  }
}