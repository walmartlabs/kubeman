/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

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