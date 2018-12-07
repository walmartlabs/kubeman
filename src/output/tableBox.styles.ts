import { Theme, createStyles } from '@material-ui/core/styles'
import {indigo, blue, red, pink, purple} from '@material-ui/core/colors'

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
    backgroundColor: palette.type ==='dark' ? '#3700B3' : '#3141b4',
  },
  tableHeaderText: {
    color: '#ffffff !important',
  },
  tableGroupRow: {
    padding: 0,
    height: 24,
    background: palette.type ==='dark' ? 
              'linear-gradient(45deg, #183BF0 20%, #3700B3 99%)' :
              'linear-gradient(45deg, #90CAF9 20%, #2962FF 99%)',
  },
  tableSubgroupRow: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? '#455A64' : '#CFD8DC',
  },
  tableRow: {
    padding: 0,
    height: 24,
  },
  tableRowHighlight: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? "#827717" : "#FFF9C4"
  },
  tableCell: {
    padding: '0px !important',
    paddingLeft: '1px !important',
  },
  tableCellHighlight: {
    padding: '0px !important',
    paddingLeft: '1px !important',
    backgroundColor: palette.type ==='dark' ? "#827717" : "#FFF9C4"
  },
  tableCellHealthGood: {
    backgroundColor: palette.type ==='dark' ? '#2E7D32' : '#DCEDC8',
  },
  tableCellHealthBad: {
    backgroundColor: palette.type ==='dark' ? '#AD1457' : '#EC407A',
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
