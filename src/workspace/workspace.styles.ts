/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { createStyles, Theme } from '@material-ui/core/styles'

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    color: palette.primary.main,
    width: '100%',
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  table: {
    verticalAlign: 'top',
    height: '100%',
    border: 0,
  },
  upperRow: {
    verticalAlign: 'top',
    border: 'none',
  },
  lowerRow: {
    verticalAlign: 'top',
    border: 'none',
    height: '80%',
  },
  bottomRow: {
    height: '50px !important',
    border: 'none',
    padding: 0,
    margin: 0,
  },
  contextCell: {
    verticalAlign: 'top',
    border: 0,
    padding: 0,
    margin: 0,
    paddingLeft: '2px !important',
    paddingRight: '2px !important',
    paddingBottom: 5,
  },
  actionCell: {
    verticalAlign: 'top',
    width: '20%',
    minWidth: 260,
    height: '100%',
    padding: 0,
    margin: 0,
    paddingLeft: 5,
    border: 0,
  },
  outputCell: {
    verticalAlign: 'top',
    border: 0,
    width: '80%',
    height: '100%',
    minWidth: 500,
    maxWidth: 900,
    minHeight: 500,
    padding: 0,
    margin: 0,
    paddingLeft: '2px !important',
    paddingRight: '2px !important',
  },
  button: {
    margin: spacing.unit,
  },
  input: {
    display: 'none',
  },
  loadingMessage: {
    display: 'block',
    marginTop: '40%',
    textAlign: 'center',
  },
  loadingLinear: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '40%',
  },
  loadingCircular: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  statusMessage: {
    display: 'inline-block',
    verticalAlign: 'middle',
    color: 'red',
  }
})

export default styles