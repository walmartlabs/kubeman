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
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
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
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
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
            minHeight: '80vh',
            maxHeight: '80vh',
            width: '80vh',
            minWidth: '80vh',
            maxWidth: '80vh',
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
    const panelColor = useDarkTheme ? 'linear-gradient(45deg, #0039b3 30%, #0049e6 99%)' :
                            'linear-gradient(45deg, #0039b3 50%, #3d00cc 99%)'

    return Object.assign({}, appTheme.activeTheme, {
      overrides: {
        MuiExpansionPanelSummary: {
          root: {
            background: panelColor,
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
            paddingBottom: '5px !important',
          }
        },
        MuiListItem: {
          root: {
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 10,
            backgroundColor: useDarkTheme ? '#404fa5'  : '#daddf1',
            borderBottom: '1px solid #9c9c9c',
          }
        },
      }
    })
  }
}

export const actionsTheme = new ActionsTheme
