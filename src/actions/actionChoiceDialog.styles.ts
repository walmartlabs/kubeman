import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  dialog: {
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
    margin: 10,
    padding: 10,
    height: 30,
    backgroundColor: '#4b6082',
  },
  dialogButton: {
    color: 'white !important'
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
    minWidth: 400,
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
})

export default styles
