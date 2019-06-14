/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  card: {
    backgroundColor: '#343148',
    color: 'white',
    width: '100%',
    height: '100%',
    padding: 0,
    overflowY: 'scroll',
  },
  cardContent: {
    padding: 0,
    paddingLeft: 5,
  },
  table: {
    height: '100%',
  },
  tableBody: {
  },
  tableRow: {
    height: 20,
  },
  tableCell: {
    padding: 2,
    paddingLeft: 10,
    borderBottom: 0,
  },
  tableCellFullLine: {
    padding: 2,
    paddingLeft: 2,
    borderBottom: 0,
    borderTop: '1px solid white',
  },
  tableCellHalfLine: {
    padding: 2,
    paddingLeft: 15,
    borderBottom: 0,
    '&::before': {
      display: 'inline-block',
      color: 'white',
      content: "''",
      width: '300px',
      height: 1,
      borderTop: '1px solid white',
    },
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: 14,
  },
  pos: {
    marginBottom: 12,
  },
  text: {
    color: 'white',
  },
})

export default styles
