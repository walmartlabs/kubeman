import { Menu, MenuItem, BrowserWindow } from 'electron'

const contextMenu = new Menu()
contextMenu.append(new MenuItem({label: 'Cut', role: 'cut'}))
contextMenu.append(new MenuItem({label: 'Copy', role: 'copy'}))
contextMenu.append(new MenuItem({label: 'Paste', role: 'paste'}))
contextMenu.append(new MenuItem({label: 'Select All', role: 'selectall'}))
contextMenu.append(new MenuItem({type: 'separator'}))
contextMenu.append(new MenuItem({label: 'Reload', role: 'reload'}))
contextMenu.append(new MenuItem({type: 'separator'}))

export default contextMenu