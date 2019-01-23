import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography, transitions }: Theme) => createStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    padding: spacing.unit,
    backgroundColor: palette.background.default,
    color: palette.primary.main,
  },
  button: {
    margin: spacing.unit,
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
  selectedAction: {
    backgroundColor: palette.type === 'dark' ? '#666600' : '#80a8ff',
    fontStyle: 'bold',
    fontWeight: 800,
  },
  listText: {
    fontSize: typography.pxToRem(10),
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
})

export default styles
