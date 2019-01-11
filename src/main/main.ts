'use strict'

import { app, BrowserWindow, Menu } from 'electron'
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';

import fs from 'fs'
import path from 'path'
import { format as formatUrl } from 'url'

import appMenu from './menu'
import './main.ipc'
import '../logger/server'


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
let mainWindow : BrowserWindow|null

async function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    backgroundColor: '#000',
    width: 1200, 
    height: 1000
  })
  appMenu.setMainWindow(mainWindow)
  const menu = Menu.buildFromTemplate(appMenu.menuTemplate)
  Menu.setApplicationMenu(menu)

  if (isDevelopment) {
    //await installExtensions();
    mainWindow.webContents.openDevTools()
    mainWindow.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
  } else {
    mainWindow.loadURL(formatUrl({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true
    }))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow && mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow && mainWindow.focus()
    setImmediate(() => {
      mainWindow && mainWindow.focus()
    })
  })
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('ready', function () {
  createWindow()
})

