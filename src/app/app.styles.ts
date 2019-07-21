/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import { createStyles, Theme } from '@material-ui/core/styles'

const styles = ({ palette, spacing }: Theme) => createStyles({
  root: {
    flexGrow: 1,
  },
  loadingMessage: {
    display: 'block',
    textAlign: 'center',
    top: '20em',
    left: '1em',
    position: 'relative',
  },
  loading: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '40%',
    top: '30em',
    left: '2em',
    position: 'relative',
  },
})

export default styles
