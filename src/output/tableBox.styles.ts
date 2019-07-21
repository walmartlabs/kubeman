/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { Theme, createStyles } from '@material-ui/core/styles'
import {indigo, blue, red, pink, purple} from '@material-ui/core/colors'

const borderLight = '1px solid #c8c8ea'
const borderDark = '1px solid rgba(255, 255, 255, 0.12)'

const columnSeparatorLight = '1px dotted #3141b4'
const columnSeparatorDark = '1px dotted #4b6082'

const styles = ({ palette, spacing, typography, breakpoints }: Theme) => createStyles({
  root: {
    width: '100%',
    height: '100%',
    padding: 0,
    backgroundColor: palette.background.paper,
  },
  filterContainer: {
    paddingLeft: 5,
  },
  tableContainer: {
    height: '97.5%',
    padding: 0,
    paddingLeft: 5,
    margin: 0,
    tableLayout: 'fixed',
  },
  table: {
    padding: 0,
    paddingLeft: 5,
    wordWrap: 'break-word',
    wordBreak: 'break-all',
  },
  tableBody: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    overflowY: 'scroll',
    overflowX: 'hidden',
    filter: palette.type ==='dark' ? 'brightness(110%)' : 'brightness(80%)',
    '& pre': {
      display: 'inline-block',
      margin: 0,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      wordWrap: 'break-word',
      wordBreak: 'break-all',
      fontFamily: 'Roboto Mono, Courier, monospace',
      height: '15px',
      color: palette.type ==='dark' ? '#d0d0d0' : '#000',
      filter: palette.type ==='dark' ? 'brightness(120%)' : 'brightness(80%)'
    },
    '& .hljs-string': {
      color: palette.type ==='dark' ? '#d17d2e' : '#2020c0'
    },
    '& .hljs-attr': {
      color: palette.type ==='dark' ? '#aaaaaa' : '#505050'
    },
  },
  tableHeaderRow: {
    padding: 0,
    height: 44,
    backgroundBlendMode: 'multiply',
    background: palette.type ==='dark' ? '#003099' : '#3141b4',
    cursor: 'pointer',
    '& p' : {
      color: '#ffffff',
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  tableSuperGroupRow: {
    padding: 0,
    height: 38,
    backgroundBlendMode: 'multiply',
    background: '#150230',
    cursor: 'pointer',
    '& td' : {
      color: '#ffffff',
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  tableGroupRow: {
    padding: 0,
    height: 36,
    backgroundBlendMode: 'multiply',
    background: '#142952',
    cursor: 'pointer',
    '& td' : {
      color: '#ffffff',
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  tableSubgroupRow: {
    padding: 0,
    height: 32,
    backgroundColor: palette.type ==='dark' ? '#262f63' : '#80a8ff',
    backgroundBlendMode: 'multiply',
    cursor: 'pointer',
    '& td' : {
      color: palette.type === 'dark' ? '#cccccc' : 'inherit',
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  tableSectionRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    fontStyle: 'italic',
    backgroundColor: palette.type === 'dark' ? '#1d2d5d' : '#9abede',
    cursor: 'pointer',
    '& td' : {
      color: palette.type === 'dark' ? '#cccccc' : 'inherit',
      fontWeight: palette.type ==='dark' ? 400 : 500,
    }
  },
  tableTitleRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type === 'dark' ? '#4a5a9a' : '#bbccff',
    '& td' : {
      color: '#000',
      fontWeight: 500,
    }
  },
  tableEmptyRow: {
    padding: 0,
    height: 5,
    borderBottom: 0,
  },
  tableRow: {
    padding: 0,
    height: 24,
    borderBottom: 0,
  },
  tableCellInnerRow: {
    padding: 0,
    margin: 0,
    marginBottom: 2,
    '&:not(:last-child)': {
      //borderBottom: '1px dotted #909090',
    },
  },
  tableCellWideRow: {
    '&:first-child' :{
      backgroundColor: '#1d2349',
      color: '#fff',
    },
    '& td' :{
      borderLeft: '1px dotted',
      paddingLeft: 2,
      paddingRight: 2,
    },
  },
  tableGroupRowSpacer: {
    height: 12,
  },
  tableRowHidden: {
    height: 20,
  },
  tableRowSpacer: {
    height: 4,
  },
  tableAppendedRow: {
    borderColor: palette.type ==='dark' ? '#806f00' : '#ffdd00',
  },
  tableWrapperCell: {
    padding: 0,
    border: 0,
    paddingRight: '5px !important',
    paddingLeft: '5px !important',
    color: 'inherit',
    verticalAlign: 'top',
    width: 'auto',
    fontSize: '0.99rem',
  },
  tableCell: {
    padding: 0,
    paddingTop: 4,
    paddingLeft: 2,
    paddingRight: 2,
    color: palette.type === 'dark' ? '#cccccc' : 'inherit',
    verticalAlign: 'top',
    width: 'auto',
    minWidth: 120,
    fontSize: '0.90rem',
    fontFamily: "Roboto",
    '&:not(:last-child)': {
      [breakpoints.up('sm')]: {
        maxWidth: '200px'
      },
      [breakpoints.up('md')]: {
        maxWidth: '250px'
      },
      [breakpoints.up('lg')]: {
        maxWidth: '300px'
      }
    }
  },
  tableGroupCell: {
    verticalAlign: 'middle',
    paddingLeft: 6,
    paddingTop: 0,
  },
  tableSubGroupCell: {
    verticalAlign: 'middle',
    paddingLeft: 4,
    paddingTop: 0,
  },
  tableDataCell: {
    fontSize: '0.87rem',
    fontWeight: palette.type ==='dark' ? 400 : 500,
  },
  tableCellCompare: {
    borderRight: palette.type ==='dark' ? columnSeparatorDark : columnSeparatorLight,
  },
  tableKeyCell: {
    backgroundColor: palette.type ==='dark' ? '#2e2e2e' : '#e0eef0',
    width: '22%',
    minWidth: 120,
  },
  tableKeyCellHighlight: {
    '&:after': {
      content: "'*'",
      color: 'red'
    },
  },
  tableCellHighlight: {
    borderLeft: '2px solid red',
    borderRight: '2px solid red',
    //backgroundColor: palette.type ==='dark' ? "#6c6313" : "#FFFDE7",
  },
  tableCellFiltered: {
    border: '1px solid blue',
    //backgroundColor: palette.type ==='dark' ? "#6c6313" : "#FFFDE7",
  },
  tableCellHealthGood: {
    backgroundColor: palette.type ==='dark' ? '#2b4b2b' : '#bbeebb',
  },
  tableCellHealthBad: {
    backgroundColor: palette.type ==='dark' ? '#573B03' : '#ecccac',
  },
  tableCellHidden: {
    padding: 0, 
    paddingLeft: 10,
    marginBottom: 10,
    textAlign: 'left',
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#dae1fa',
  },
  tableGridCell: {
    paddingLeft: 2,
    '&:not(:last-child)': {
      //borderBottom: '1px dashed #808080'
    }
  },
  tableSpacerCell: {
    height: 0,
    border: 0,
    padding: 0,
  },
  searchHighlight: {
    backgroundColor: palette.type ==='dark' ? '#FF7788' : '#FFCC80',
  },
  grid: {
    
  },
  gridCell: {

  },
  filterInput: {
    fontSize: '0.89rem',
  },
  loading: {
    position: 'absolute',
    zIndex: 1000,
    top: '60%',
    left: '60%',
    marginLeft: 'auto',
    marginRight: 'auto',
    margin: spacing.unit * 2,
    color: palette.secondary.main,
  },
})

export default styles
