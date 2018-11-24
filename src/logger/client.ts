import {ipcRenderer as ipc} from 'electron'

const log = {
  onClient(...output) {
    console.log(...output)
  },
  onServer(...output) {
    ipc.send('log', {output})
  }
}
export default log