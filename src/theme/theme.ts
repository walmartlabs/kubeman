import { withStyles, createStyles, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import {ThemeOptions} from '@material-ui/core/styles/createMuiTheme'

import { Breakpoints, BreakpointsOptions } from '@material-ui/core/styles/createBreakpoints';
import { Mixins, MixinsOptions } from '@material-ui/core/styles/createMixins';
import { Palette, PaletteOptions, dark } from '@material-ui/core/styles/createPalette';
import { Typography, TypographyOptions } from '@material-ui/core/styles/createTypography';
import { Shadows } from '@material-ui/core/styles/shadows';
import { Shape, ShapeOptions } from '@material-ui/core/styles/shape';
import { Spacing, SpacingOptions } from '@material-ui/core/styles/spacing';
import { Transitions, TransitionsOptions } from '@material-ui/core/styles/transitions';
import { ZIndex, ZIndexOptions } from '@material-ui/core/styles/zIndex';
import { Overrides } from '@material-ui/core/styles/overrides';
import { ComponentsProps } from '@material-ui/core/styles/props';


import expansionClosedColor from '@material-ui/core/colors/blueGrey';
import expansionOpenColor from '@material-ui/core/colors/blue';


class AppTheme {
  darkTheme: ThemeOptions = {
    palette: {
      type: 'dark'
    },
  }
  lightTheme: ThemeOptions = {
    palette: {
      type: 'light'
    },
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