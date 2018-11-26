import React, {SyntheticEvent} from 'react';
import _ from 'lodash'
import deburr from 'lodash/deburr';
import Autosuggest from 'react-autosuggest'
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';
import { withStyles, WithStyles, createStyles, withTheme, WithTheme, Theme, MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import FormHelperText from '@material-ui/core/FormHelperText';

import {Pod, Item, KubeComponent} from "../k8s/k8sTypes";
import { Button, Input, InputAdornment } from '@material-ui/core';


const styles = ({ palette, spacing, typography }: Theme) => createStyles({
  root: {
    height: 250,
    flexGrow: 1,
  },
  container: {
    position: 'relative',
  },
  suggestionsContainerOpen: {
    position: 'absolute',
    zIndex: 1,
    marginTop: spacing.unit,
    left: 0,
    right: 0,
  },
  suggestion: {
    display: 'block',
  },
  suggestionsList: {
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  suggestionItem: {
    fontSize: '0.9em'
  },
  divider: {
    height: spacing.unit * 2,
  },
  input: {
    marginTop: 20,
  },
  button: {
    marginBottom: 5,
  }
})


interface PodFilterProps extends WithStyles<typeof styles> {
  pods : {[group: string]: Pod[]}
  filter: string
  onApplyFilter: (string, []: Pod[]) => void
}

interface PodFilterState {
  suggestions: Pod[]
  text: string
}

class PodFilter extends React.Component<PodFilterProps, PodFilterState> {
  state: PodFilterState = {
    suggestions: [],
    text: ''
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: PodFilterProps) {
    const {filter} = props
    let suggestions : Pod[] = []
    if(filter && filter !== '') {
      suggestions = this.getSuggestions(filter)
    }
    this.setState({text: filter, suggestions})
  }

  getSuggestions(input: string) : Pod[] {
    input = deburr(input.trim()).toLowerCase();
    const {pods} = this.props
    
    const matches: Pod[] = input.length === 0 ? [] :
       _.flatten(_.values(pods))
        .filter(pod => pod.name.includes(input))

    return matches
  }

  getSuggestionValue = (pod: Pod) : string => {
    return pod.name
  }

  onSuggestionsFetchRequested = ({value}) => {
    this.setState({
      suggestions: this.getSuggestions(value)
    })
  }

  onChange = (event: SyntheticEvent, {newValue}) => {
    newValue = newValue || ''
    this.setState({text: newValue})
  }

  onApply = () => {
    const { text, suggestions } = this.state
    this.props.onApplyFilter(text, suggestions)
  }

  renderInputComponent = (inputProps) => {
    const { classes } = this.props
    const { inputRef = () => {}, ref, ...other } = inputProps;
  
    return (
      <div>
        <Input
          fullWidth
          {...other}
          className={classes.input}
          inputProps={{
            'aria-label': 'Pod Filter',
          }}
          endAdornment={
            <InputAdornment position="end">
              <Button color="primary" variant="contained" size="small"
                    className={classes.button}
                    onClick={this.onApply}
                >
                Apply
              </Button>
          </InputAdornment>
          }
        />
      </div>
    );
  }

  renderSuggestion = (pod: Pod, {query, isHighlighted }) => {
    const { classes } = this.props
    const matches = match(pod.name, query);
    const parts = parse(pod.name, matches);
    return (
      <MenuItem selected={isHighlighted} component="div">
        <div>
          {parts.map((part, index) => {
            return part.highlight ? (
              <span key={String(index)} style={{ fontWeight: 500 }}
                    className={classes.suggestionItem}>
                {part.text}
              </span>
            ) : (
              <strong key={String(index)} style={{ fontWeight: 300 }}
                      className={classes.suggestionItem}>
                {part.text}
              </strong>
            );
          })}
        </div>
      </MenuItem>
    )
  }

  render() {
    const { classes } = this.props
    const { text, suggestions } = this.state

    const inputProps = {
      placeholder: 'Type something',
      value: text,
      onChange: this.onChange,
      width: '80%',
      size: 50
      }
    const theme = {
      container: classes.container,
      suggestionsContainerOpen: classes.suggestionsContainerOpen,
      suggestionsList: classes.suggestionsList,
      suggestion: classes.suggestion,
    }

    return (
      <Autosuggest
        suggestions={suggestions}
        inputProps={inputProps}
        theme={theme}
        alwaysRenderSuggestions={true}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        getSuggestionValue={this.getSuggestionValue}
        renderSuggestion={this.renderSuggestion}
        renderInputComponent={this.renderInputComponent}
        renderSuggestionsContainer={options => (
          <Paper {...options.containerProps} square>
            {suggestions.length > 0 &&
              <FormHelperText>The filter matches {suggestions.length} Pod(s): </FormHelperText>
            }
            {options.children}
          </Paper>
        )}
      />
    )
  }
}

export default withStyles(styles)(PodFilter)
