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
  },
  table: {
    padding: 0,
    paddingLeft: 5,
  },
  tableBody: {
  },
  tableHeaderRow: {
    padding: 0,
    height: 36,
    backgroundBlendMode: 'multiply',
    backgroundColor: palette.type ==='dark' ? '#3700B3' : '#D0D7FB',
  },
  tableGroupRow: {
    padding: 0,
    height: 24,
    background: palette.type ==='dark' ? 
              'linear-gradient(45deg, #183BF0 20%, #3700B3 99%)' :
              'linear-gradient(45deg, #D0D7FB 20%, #183BF0 99%)',
  },
  tableRow: {
    padding: 0,
    height: 24,
  },
  tableRowHighlight: {
    padding: 0,
    height: 24,
    backgroundColor: palette.type ==='dark' ? "#DD2C00" : "#FFE0B2"
  },
  tableCell: {
    padding: 0,
    paddingLeft: 5,
  },
  tableCellHealthGood: {
    backgroundColor: palette.type ==='dark' ? '#2E7D32' : '#81C784',
  },
  tableCellHealthBad: {
    backgroundColor: palette.type ==='dark' ? '#AD1457' : '#EC407A',
  },
})

export default styles
