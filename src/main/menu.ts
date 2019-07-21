/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { app, BrowserWindow } from 'electron'

export default class AppMenu {
  static mainWindow?: BrowserWindow
  static createWindow?: () => void

  static init(w, cw) {
    this.mainWindow = w
    this.createWindow = cw
  }

  static menuTemplate: Array<Object> = [
    {
      label: app.getName(),
      submenu: [
        {label: 'About '+app.getName(), role: 'about'},
        {type: 'separator'},
        {label: 'New Window', accelerator: 'CmdOrCtrl+N', 
                click: () => AppMenu.createWindow && AppMenu.createWindow()},
        {type: 'separator'},
        {label: 'Preferences', accelerator: 'Command+,'},
        {type: 'separator'},
        {label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: app.quit}
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
        {label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo'},
        {type: 'separator'},
        {label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut'},
        {label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy'},
        {label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste'},
        {label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall'},
        {type: 'separator'},
        {label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload'}
      ]
    }, 
    {
      label: 'Debug',
      submenu: [
        {
          label: 'View Debug Console', 
                click: () => AppMenu.mainWindow && AppMenu.mainWindow.webContents.openDevTools()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {label: 'Not Available'}
      ]
    }
  ]
}
