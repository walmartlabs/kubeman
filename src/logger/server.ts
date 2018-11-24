import { ipcMain as ipc } from 'electron'

ipc.on('log', (event: Electron.Event, args: any) => {
  console.log(...args.output)
})


