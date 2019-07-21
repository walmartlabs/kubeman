/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { app, BrowserWindow, Menu, ipcMain as ipc} from 'electron'
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';
import fs from 'fs'
import path from 'path'
import { format as formatUrl } from 'url'
import AppMenu from './menu'
import './main.ipc'
import '../logger/server'

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0"

const installExtensions = async () => {
  return Promise.all(
    [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS].map(name => installExtension(name))
  ).catch(console.log)
};

const isDevelopment = process.env.NODE_ENV !== 'production'
if (isDevelopment) {
  app.commandLine.appendSwitch('remote-debugging-port', '9223')
}

// global reference to mainWindow (necessary to prevent window from being garbage collected)
const windows : (BrowserWindow|null)[] = []
let lastContext

async function createWindow() {
  const window = new BrowserWindow({
    show: false,
    backgroundColor: '#000',
    width: 1200, 
    height: 1000,
    icon: path.join(__dirname, 'build/icon.icns')
  })

  const isMainWindow = windows.length === 0
  window['index'] = windows.length
  windows.push(window)

  if(isMainWindow) {
    AppMenu.init(window, createWindow)
    const menu = Menu.buildFromTemplate(AppMenu.menuTemplate)
    Menu.setApplicationMenu(menu)
  }
  
  if (isDevelopment) {
    //await installExtensions();
    isMainWindow && window.webContents.openDevTools({ mode: 'detach' })
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
  } else {
    window.loadURL(formatUrl({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true
    }))
  }

  window.once('ready-to-show', () => {
    window && window.show()
  })

  window.on('closed', () => {
    windows[window['index']] = null
  })

  window.webContents.on('devtools-opened', () => {
    window && window.focus()
    setImmediate(() => {
      window && window.focus()
    })
  })
  setTimeout(window.webContents.send.bind(window.webContents, 'updateContext', lastContext), 3000)
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (windows.length === 0) {
    createWindow()
  }
})

app.on('ready', function () {
  if (windows.length === 0) {
    createWindow()
  }
})

ipc.on('context', (event: Electron.Event, context: {clusters: any[], namespaces: any[]}) => {
  if(context.clusters && context.clusters.length > 0) {
    lastContext = context
  }
})

