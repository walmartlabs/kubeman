import React, {SyntheticEvent} from 'react';
import Autosuggest from 'react-autosuggest'
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

import { withStyles, WithStyles } from '@material-ui/core/styles'
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import { Button, Input, InputAdornment, FormHelperText, FormGroup,
      FormControlLabel, Checkbox } from '@material-ui/core';

import {Namespace, KubeComponent} from "../k8s/k8sObjectTypes";
import SelectionManager from './selectionManager'

import styles from './selectionFilter.styles'


interface SelectionFilterProps extends WithStyles<typeof styles> {
  filter: string
  onApplyFilter: (string, []: Namespace[]) => void
}

interface SelectionFilterState {
  namespaceSuggestions: Namespace[]
  filterText: string
}

export class SelectionFilter extends React.Component<SelectionFilterProps, SelectionFilterState> {
  state: SelectionFilterState = {
    namespaceSuggestions: [],
    filterText: '',
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  async componentWillReceiveProps(props: SelectionFilterProps) {
    const {filter} = props
    this.setState({filterText: filter})
    if(filter && filter !== '') {
      const matches = await SelectionManager.getMatchingNamespaces(filter)
      this.setState({namespaceSuggestions: matches})
    }
  }

  getSelections() {
    const {filterText, namespaceSuggestions} = this.state
    return {namespaces: namespaceSuggestions, filterText}
  }

  getSuggestionValue = (item: KubeComponent) : string => {
    return item.name
  }

  onSuggestionsFetchRequested = async ({value, reason}) => {
    value = reason === 'suggestion-selected' ? this.state.filterText : value
    const matches = await SelectionManager.getMatchingNamespaces(value)
    this.setState({
      namespaceSuggestions: matches
    })
  }

  onInputChange = (event: SyntheticEvent, {newValue, method}) => {
    if(method !== 'click') {
      newValue = newValue || ''
      this.setState({filterText: newValue})
    }
  }

  onApply = () => {
    const {filterText, namespaceSuggestions} = this.state
    this.props.onApplyFilter(filterText, namespaceSuggestions)
  }

  renderInputComponent = (inputProps) => {
    const { classes } = this.props
    const { inputRef = () => {}, ref, ...other } = inputProps;
  
    return (
      <div>
        <Input fullWidth autoFocus
          {...other}
          className={classes.input}
          inputProps={{
            'aria-label': 'Namespace Filter',
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

  renderSectionTitle = (section) => {
    const { classes } = this.props
    return(
      <FormHelperText className={classes.sectionTitle}>
        {section.title}
      </FormHelperText>
    )
  }

  getSectionSuggestions = (section) => {
    return section.suggestions
  }

  renderSuggestion = (item: KubeComponent, {query, isHighlighted }) => {
    const { classes } = this.props
    const matches = match(item.name, query);
    const parts = parse(item.name, matches);
    return (
      <MenuItem selected={isHighlighted} component="div">
        <div style={{width: '100%'}}>
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
            )
          })}
          {item instanceof Namespace && 
            <span style={{ fontWeight: 300, float: 'right' }} className={classes.suggestionItem}>
              {item.cluster.name}
            </span>
          }
        </div>
      </MenuItem>
    )
  }

  render() {
    const { classes } = this.props
    const { filterText, namespaceSuggestions} = this.state

    const inputProps = {
      placeholder: 'Search for namespaces',
      value: filterText,
      onChange: this.onInputChange,
      width: '80%',
      size: 50
      }
    const theme = {
      container: classes.container,
      suggestionsContainerOpen: classes.suggestionsContainerOpen,
      suggestionsList: classes.suggestionsList,
      suggestion: classes.suggestion,
    }
    let suggestions: any[] = []
    if(namespaceSuggestions.length > 0) {
      suggestions.push({
        title: "Namespaces",
        suggestions: namespaceSuggestions
      })
    }
    
    return (
      <div>
        <Autosuggest
          suggestions={suggestions}
          inputProps={inputProps}
          theme={theme}
          multiSection={true}
          focusInputOnSuggestionClick={false}
          alwaysRenderSuggestions={true}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          renderSectionTitle={this.renderSectionTitle}
          getSectionSuggestions={this.getSectionSuggestions}
          getSuggestionValue={this.getSuggestionValue}
          renderSuggestion={this.renderSuggestion}
          renderInputComponent={this.renderInputComponent}
          renderSuggestionsContainer={options => (
            <Paper {...options.containerProps} square>
              {namespaceSuggestions.length > 0 &&
                <FormHelperText>
                  The filter matches {namespaceSuggestions.length} Namespaces. 
                </FormHelperText>
              }
              {options.children}
            </Paper>
          )}
        />
      </div>
    )
  }
}

export default withStyles(styles)(SelectionFilter)
