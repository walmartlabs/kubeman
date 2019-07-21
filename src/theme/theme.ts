/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {ThemeOptions} from '@material-ui/core/styles/createMuiTheme'

import {indigo, blue, red, pink, purple} from '@material-ui/core/colors'

import expansionClosedColor from '@material-ui/core/colors/blueGrey'
import expansionOpenColor from '@material-ui/core/colors/blue'


class AppTheme {
  darkTheme: ThemeOptions = {
    palette: {
      type: 'dark',
      primary: indigo,
      error: red,
      background: {
        default: '#252a2b',
        paper: '#202020',
      },
    },
    typography: {
      fontFamily: [
        'Roboto',
        '"Segoe UI"',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
    }
  }
  lightTheme: ThemeOptions = {
    palette: {
      type: 'light',
      secondary: blue,
      background: {
        default: '#dae1ea',
        paper: '#dae1ea',
      },
    },
    typography: {
      fontFamily: [
        'Roboto',
        '"Segoe UI"',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
    }
  }
  activeTheme: ThemeOptions = this.lightTheme

  setActiveTheme(useDarkTheme: boolean) {
    this.activeTheme = useDarkTheme ? this.darkTheme : this.lightTheme
  }
}

export const appTheme = new AppTheme


class SelectionDialogTheme {
  getTheme(useDarkTheme: boolean): ThemeOptions {
    return Object.assign({}, appTheme.activeTheme, {
      overrides: {
        MuiDialog: {
          paper: {
            height: '80vh',
            width: '80vh',
            minHeight: '60vh',
            minWidth: '60vh',
            maxHeight: '80vh',
            maxWidth: '80vh !important',
          }
        },
        MuiTabs: {
          root: {
            backgroundColor: '#4b6082'
          },
          indicator: {
            borderBottom: '3px solid #1890ff',
            backgroundColor: '#1890ff',
          },
        },
        MuiExpansionPanelSummary: {
          root: {
            backgroundColor: expansionClosedColor[useDarkTheme ? 800 : 200],
            height: 64,
            marginTop: 17,
          },
          expanded: {
            backgroundColor: expansionOpenColor[useDarkTheme ? 800 : 200],
          }
        },
        MuiTableCell: {
          root: {
            margin: 0,
            padding: 0,
          }
        }
      }
    })
  }
}

export const selectionDialogTheme = new SelectionDialogTheme

class ActionsTheme {
  getTheme(useDarkTheme: boolean): ThemeOptions {
    const panelColor = 'linear-gradient(45deg, #003099 50%, #2e0099 99%)'

    return Object.assign({}, appTheme.activeTheme, {
      overrides: {
        MuiExpansionPanelSummary: {
          root: {
            backgroundColor: useDarkTheme ? '#003099' : '#003099',
            color: 'white !important',
            margin: 0,
            minHeight: '40px !important',
            height: '40px !important',
            lineHeight: 1,
          },
          content: {
            minHeight: '40px !important',
            height: '40px !important',
            lineHeight: 1,
            margin: 0,
            fontWeight: '800 !important',
            '& :last-child': {
              paddingRight: '5px !important',
            }
          },
          expanded: {
            color: 'white !important',
            minHeight: '40px !important',
            height: '40px !important',
            lineHeight: 1,
            margin: '0px !important',
          },
          expandIcon: {
            color: '#D8DDF3 !important',
            top: '50%',
            padding: 0,
          },
        },
        MuiTouchRipple: {
          root: {
            height: 40,
          }
        },
        MuiTypography: {
          root: {
            paddingTop: 9,
          },
          body2: {
            color: 'inherit',
          },
        },
        MuiExpansionPanelDetails: {
          root: {
            padding: 0,
          },
        },
        MuiList: {
          root: {
            paddingTop: '0px !important',
            paddingBottom: '0px !important',
          }
        },
        MuiListItem: {
          root: {
            paddingTop: 0,
            paddingBottom: 5,
            paddingLeft: 10,
            backgroundColor: useDarkTheme ? '#1d2349'  : '#daddf1',
            boxShadow: useDarkTheme ? '0px 1px 1px 0px rgba(255, 255, 255, 0.5)' : '0px 1px 1px 0px rgba(0, 0, 255, 0.5)',
            '&:hover':{
              color: useDarkTheme ? 'white' : 'black'
            },
          }
        },
        MuiCheckbox: {
          root: {
            paddingRight: 5,
            paddingLeft: 20,
            paddingTop: 12,
          },
        },
        MuiFormControlLabel: {
          root: {
            marginRight: 2,
          },
          label: {
            paddingTop: 0,
          },
        },
      }
    })
  }
}

export const actionsTheme = new ActionsTheme
