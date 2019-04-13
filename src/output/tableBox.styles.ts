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
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
  },
  filterContainer: {
    paddingLeft: 5,
  },
  tableContainer: {
    height: '100%',
    padding: 0,
    paddingLeft: 5,
    margin: 0,
    tableLayout: 'fixed',
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
  },
  table: {
    padding: 0,
    paddingLeft: 5,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
  },
  tableBody: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
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
      fontSize: '0.9rem',
      height: '15px',
      filter: palette.type ==='dark' ? 'brightness(120%)' : 'brightness(70%)'
    },
  },
  tableHeaderRow: {
    padding: 0,
    height: 36,
    backgroundBlendMode: 'multiply',
    background: palette.type ==='dark' ? 
          'linear-gradient(45deg, #4b6082 20%, #4b6082 99%)'
          : 'linear-gradient(45deg, #3141b4 20%, #3141b4 99%)'
  },
  tableHeaderText: {
    color: '#ffffff !important',
  },
  tableGroupRow: {
    padding: 0,
    height: 36,
    backgroundBlendMode: 'multiply',
    color: '#ffffff !important',
    background: 'linear-gradient(45deg, #2952a3 80%, #142952 99%)',
    cursor: 'pointer',
  },
  tableSubgroupRow: {
    padding: 0,
    height: 32,
    backgroundColor: palette.type ==='dark' ? '#234B6D' : '#9abede',
    backgroundBlendMode: 'multiply',
    boxShadow: 'inset 0.05em 0em 0em 1px rgba(0, 0, 0, .5)',
    cursor: 'pointer',
  },
  tableSectionRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type === 'dark' ? '#455A64' : '#80a8ff',
    boxShadow: 'inset 0.1em 0em 0em 1px rgba(0, 0, 0, .3)',
    cursor: 'pointer',
  },
  tableEmptyRow: {
    padding: 0,
    height: 5,
    borderBottom: 0,
  },
  tableRow: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#dae1fa',
    borderBottom: 0,
  },
  tableCellInnerRow: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#dae1fa',
  },
  tableGroupRowSpacer: {
    height: 12,
  },
  tableRowSpacer: {
    height: 4,
  },
  tableAppendedRow: {
    borderColor: palette.type ==='dark' ? '#806f00' : '#ffdd00',
  },
  tableCell: {
    padding: '0px',
    color: 'inherit',
    verticalAlign: 'top',
    width: 'auto',
    minWidth: 120,
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
    borderLeft: '1px solid red',
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
    textAlign: 'left',
    paddingLeft: 10,
    backgroundColor: palette.type ==='dark' ? palette.background.default : '#bcccdc',
  },
  tableGridCell: {
    '&:not(:last-child)': {
      borderBottom: '1px dashed #808080'
    }
  },
  searchHighlight: {
    backgroundColor: palette.type ==='dark' ? '#804d00' : '#FFCC80',
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
