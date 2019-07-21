/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  list: {
    maxHeight: '92%',
    margin: 5,
    backgroundColor: palette.background.paper,
    overflow: 'auto',
    boxShadow: '0px 1px 5px 0px rgba(0, 0, 255, 0.4), 0px 2px 2px 0px rgba(0, 0, 255, 0.2), 0px 3px 1px -2px rgba(0, 0, 255, 0.2)',
  },
  listHeader: {
    padding: 0,
    paddingLeft: 5,
    backgroundColor: palette.type === 'dark' ? '#4b6082' : '#283593',
    color: 'white',
    lineHeight: 2,
  },
  listItem: {
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 5,
  },
  listInfoText: {
    fontSize: '0.85em',
    marginLeft: 20,
    marginRight: 5,
    marginTop: 2,
    float: 'right',
  },
  panel: {
    overflowX: 'auto',
    overflowY: 'hidden',
    backgroundColor: palette.background.paper,
  },
  grid: {
    height: 50,
    width: '100%',
  },
  gridItem: {
    maxHeight: 50,
    paddingTop: '8px !important',
  },
  tabsRoot: {
    borderBottom: '1px solid #e8e8e8',
  },
  tabsIndicator: {
    backgroundColor: '#1890ff',
  },
  tabRoot: {
    textTransform: 'initial',
    minWidth: 72,
    fontWeight: typography.fontWeightRegular,
    marginRight: spacing.unit * 4,
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
    '&:hover': {
      color: '#40a9ff',
      opacity: 1,
    },
    '&$tabSelected': {
      color: '#1890ff',
      fontWeight: typography.fontWeightMedium,
    },
    '&:focus': {
      color: '#40a9ff',
    },
  },
  tabSelected: {},
  tabButton: {
    color: 'white !important',
    backgroundColor: '#0041cc',
  },
  card: {
    width: '100%',
    height: '100%',
    fontSize: '1.1em',
    backgroundColor: palette.background.paper
  },
})

export default styles

