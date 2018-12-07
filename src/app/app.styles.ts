import { createStyles, Theme } from '@material-ui/core/styles'

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    flexGrow: 1,
    backgroundColor: palette.type === 'dark' ? palette.background.paper : '#edeef8',
  }
})

export default styles
