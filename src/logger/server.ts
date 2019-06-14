/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { ipcMain as ipc } from 'electron'

ipc.on('log', (event: Electron.Event, args: any) => {
  console.log(...args.output)
})


