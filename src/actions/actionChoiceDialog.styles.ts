/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  dialog: {
    height: '60vh',
    width: '50vh',
    minHeight: '40vh',
    minWidth: '40vh',
    maxHeight: '60vh',
    maxWidth: '60vh !important',
  },
  dialogTitle: {
    height: 70,
    padding: 10,
    backgroundColor: '#4b6082',
  },
  filterInput: {
    fontSize: '0.9rem',
    color: 'white',
  },
  dialogContent: {
    padding: 10,
  },
  dialogActions: {
    margin: '0px !important',
    padding: '0px !important',
    height: 60,
    backgroundColor: '#4b6082',
  },
  dialogButton: {
    color: 'white !important',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginRight: 2,
  },
  dialogButtonDisabled: {
    color: '#c2c2d6 !important'
  },
  loading: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  formControl: {
    margin: spacing.unit * 0.9,
    padding: spacing.unit * 0.7,
  },
  table: {
  },
  tableContainer: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
    overflowY: 'scroll',
    overflowX: 'hidden',
  },
  expansion: {
    width: '100%',
  },
  expansionHead: {
    backgroundColor: '#4b6082',
  },
  expansionHeadText: {
    color: '#ffffff',
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
  },
  expansionDetails: {
    display: 'block',
    padding: 5,
  },
  tableCell: {
    margin: 0,
    padding: 0,
  },
  choice: {
    paddingTop: 10,
    paddingBottom: 5,
  },
  choiceCheckbox: {
    height: 20,
    paddingTop: 15,
    paddingBottom: 5,
  },
  allCheckbox: {
    height: 20,
    width: 33,
    paddingTop: 15,
    paddingBottom: 15,
    color: 'white',
  },
  choiceSubtext: {
    display: 'block',
    paddingLeft: 33,
    paddingBottom: 5,
    cursor: 'pointer',
  },
  heading: {
    color: 'white !important',
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
  },
  floatLeft: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '20%',
  },
  floatRight: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '80%',
  }
})

export default styles
