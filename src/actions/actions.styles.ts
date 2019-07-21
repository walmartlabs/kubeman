/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography, transitions }: Theme) => createStyles({
  root: {
    overflowY: 'scroll', 
    height: '97%'
  },
  actionButton: {
    margin: spacing.unit,
    float: 'right',
  },
  expansion: {
    width: '100%',
  },
  expansionHead: {
    fontSize: typography.pxToRem(15),
    fontWeight: typography.fontWeightRegular,
  },
  expansionDetails: {
    display: 'block',
  },
  menuItem: {
  },
  selectedMenuItem: {
    backgroundColor: palette.type === 'dark' ? '#666600' : '#80a8ff',
    fontWeight: 800,
  },
  listText: {
    fontSize: typography.pxToRem(10),
    '& p': {
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  refreshRoot: {
    'label + &': {
      marginTop: 0,
    },
  },
  refreshInput: {
    display: 'inline-block',
    marginTop: 0,
    borderRadius: 4,
    border: '1px solid #ced4da',
    fontSize: 14,
    paddingTop: 3,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 2,
    transition: transitions.create(['border-color', 'box-shadow']),
    '&:focus': {
      borderColor: '#80bdff',
      boxShadow: '0 0 0 0.2rem rgba(0,123,255,.25)',
    },
  },
  invalidRefreshInput: {
    border: '1px solid red',
    '&:focus': {
      borderColor: 'red',
      boxShadow: '0 0 0 0.2rem rgba(255,0,0,.25)',
    },
  },
  filterContainer: {
    paddingLeft: 5,
    marginBottom: 3,
  },
  filterInput: {
    fontSize: '0.9rem',
  },
})

export default styles
