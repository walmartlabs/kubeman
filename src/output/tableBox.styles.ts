import { Theme, createStyles } from '@material-ui/core/styles'
import {indigo, blue, red, pink, purple} from '@material-ui/core/colors'

const borderLight = '1px solid #c8c8ea'
const borderDark = '1px solid rgba(255, 255, 255, 0.12)'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    width: '100%',
    height: '100%',
    overflowY: 'scroll',
    overflowX: 'auto',
    padding: 0,
    paddingLeft: 5,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
  },
  table: {
    padding: 0,
    paddingLeft: 5,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#edeef8',
  },
  tableBody: {
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
    height: 24,
    backgroundBlendMode: 'multiply',
    background: palette.type ==='dark' ? 
              'linear-gradient(45deg, #0e2fd8 20%, #0b25a8 99%)' :
              'linear-gradient(45deg, #90CAF9 20%, #2962FF 99%)',
  },
  tableSubgroupRow: {
    padding: 0,
    height: 24,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type ==='dark' ? '#455A64' : '#CFD8DC',
  },
  tableRow: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? palette.background.paper : '#dadcf1',
  },
  tableRowHighlight: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? "#827717" : "#FFF9C4"
  },
  tableCell: {
    padding: '0px',
    borderBottom: palette.type ==='dark' ? borderDark : borderLight,
  },
  pre: {
    fontSize: '1.1rem',
    display: 'inline-block',
    height: '15px',
  },
  tableCellHighlight: {
    padding: '0px',
    backgroundColor: palette.type ==='dark' ? "#6c6313" : "#FFF9C4",
  },
  tableCellHealthGood: {
    padding: '0px',
    backgroundColor: palette.type ==='dark' ? '#2E7D32' : '#DCEDC8',
    borderBottom: palette.type ==='dark' ? borderDark : borderLight,
  },
  tableCellHealthBad: {
    padding: '0px',
    backgroundColor: palette.type ==='dark' ? '#AD1457' : '#EC407A',
    borderBottom: palette.type ==='dark' ? borderDark : borderLight,
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
})

export default styles
