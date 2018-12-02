import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    padding: spacing.unit,
    color: palette.primary.main,
  },
  loading: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
})

export default styles
