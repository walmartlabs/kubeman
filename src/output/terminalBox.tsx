import React from "react";
import Terminal from './terminal'

interface IProps {
  output?: string
  style?: {}
  options?: {}
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

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
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
    const {...others} = this.props
    return (
      <Terminal ref='terminal'
      {...others}
      output={this.props.output}
      connected={false}
    />
    )
  }
}