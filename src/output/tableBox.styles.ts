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
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
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
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
  },
  table: {
    padding: 0,
    paddingLeft: 5,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
  },
  tableBody: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
    overflowY: 'scroll',
    overflowX: 'hidden',
    '& pre': {
      display: 'inline-block',
      margin: 0,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      wordWrap: 'break-word',
      wordBreak: 'break-all',
      fontFamily: 'Courier, monospace',
      fontSize: '0.99rem',
      height: '15px',
      color: palette.type ==='dark' ? '#d0d0d0' : 'rgba(15, 15, 150, 0.8)',
      filter: palette.type ==='dark' ? 'brightness(110%)' : 'brightness(90%)'
    },
    '& .hljs-string': {
      color: palette.type ==='dark' ? '#d17d2e' : '#202090'
    },
    '& .hljs-attr': {
      color: palette.type ==='dark' ? '#c0c0c0' : '#505050'
    },
  },
  tableHeaderRow: {
    padding: 0,
    height: 44,
    backgroundBlendMode: 'multiply',
    background: palette.type ==='dark' ? '#003099' : '#3141b4',
    cursor: 'pointer',
  },
  tableHeaderText: {
    color: '#ffffff !important',
  },
  tableSuperGroupRow: {
    padding: 0,
    height: 38,
    backgroundBlendMode: 'multiply',
    color: '#ffffff !important',
    background: '#150230',
    cursor: 'pointer',
  },
  tableGroupRow: {
    padding: 0,
    height: 36,
    backgroundBlendMode: 'multiply',
    color: '#ffffff !important',
    background: '#142952',
    cursor: 'pointer',
  },
  tableSubgroupRow: {
    padding: 0,
    height: 32,
    backgroundColor: palette.type ==='dark' ? '#262f63' : '#9abede',
    backgroundBlendMode: 'multiply',
    cursor: 'pointer',
  },
  tableSectionRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type === 'dark' ? '#2d3a47' : '#80a8ff',
    cursor: 'pointer',
  },
  tableTitleRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type === 'dark' ? '#505050' : '#a0b0c0',
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
    height: 24,
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
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
  },
  tableRowHidden: {
    height: 20,
  },
  tableRowSpacer: {
    height: 4,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#edeef8',
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
    color: 'inherit',
    verticalAlign: 'top',
    width: 'auto',
    minWidth: 120,
    fontSize: '0.90rem',
    [breakpoints.up('sm')]: {
      maxWidth: '200px'
    },
    [breakpoints.up('md')]: {
      maxWidth: '250px'
    },
    [breakpoints.up('lg')]: {
      maxWidth: '300px'
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
  tableCellCompare: {
    borderRight: palette.type ==='dark' ? columnSeparatorDark : columnSeparatorLight,
  },
  tableKeyCell: {
    backgroundColor: palette.type ==='dark' ? '#3e3e3e' : '#bcccdc',
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
    fontSize: '0.9rem',
  },
  loading: {
    position: 'absolute',
    top: '60%',
    left: '60%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: 'transparent',
  },
})

export default styles
