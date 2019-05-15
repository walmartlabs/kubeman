import { Theme, createStyles } from '@material-ui/core/styles'

const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  dialogContent: {
    backgroundColor: palette.type === 'dark' ? palette.background.paper : '#edeef8',
  },
  dialogActions: {
    backgroundColor: '#4b6082',
  },
  dialogButton: {
    color: 'white !important'
  },
  loading: {
    display: 'block',
    marginTop: '40%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: 'transparent',
  },
  updating: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: 'transparent',
  },
  floatLeft: {
    display: 'flex',
    flexDirection: 'row',
   justifyContent: 'flex-start',
   width: '100%',
  },
  floatRight: {
    display: 'flex',
    flexDirection: 'row',
   justifyContent: 'flex-end',
   width: '100%',
  }
})

export default styles
