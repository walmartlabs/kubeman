import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
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
    backgroundColor: palette.type === 'dark' ? '#805500' : '#b6dcfb',
    fontStyle: 'bold',
    fontWeight: 800,
  },
  listText: {
    fontSize: typography.pxToRem(10),
  }
})

export default styles
