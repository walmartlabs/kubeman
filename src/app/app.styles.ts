import { createStyles, Theme } from '@material-ui/core/styles'

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    flexGrow: 1,
    backgroundColor: palette.background.paper,
  }
})

export default styles
