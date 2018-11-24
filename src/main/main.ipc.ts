import { BrowserWindow, ipcMain as ipc, remote, MenuItem } from 'electron'
import contextMenu from './context.menu'

ipc.on('show-context-menu', (event: Electron.Event, coords: {x: number, y: number}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  contextMenu.popup({window: win})
  //event.returnValue = 'Sync Response shown!'
  //event.sender.send('asynchronous-reply', 'Async Response')
})
