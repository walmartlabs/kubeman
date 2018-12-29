import React, {SyntheticEvent} from 'react';
import Autosuggest from 'react-autosuggest'
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

import { withStyles, WithStyles } from '@material-ui/core/styles'
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import { Button, Input, InputAdornment, FormHelperText } from '@material-ui/core';

import {Pod, Namespace, KubeComponent} from "../k8s/k8sObjectTypes";
import SelectionManager from './selectionManager'

import styles from './podFilter.styles'


interface PodFilterProps extends WithStyles<typeof styles> {
  filter: string
  onApplyFilter: (string, []: Namespace[], []: Pod[]) => void
}

interface PodFilterState {
  podSuggestions: Pod[]
  namespaceSuggestions: Namespace[]
  filterText: string
}

class PodFilter extends React.Component<PodFilterProps, PodFilterState> {
  state: PodFilterState = {
    podSuggestions: [],
    namespaceSuggestions: [],
    filterText: '',
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(props: PodFilterProps) {
    const {filter} = props
    let podSuggestions : Pod[] = []
    let namespaceSuggestions: Namespace[] = []
    if(filter && filter !== '') {
      podSuggestions = SelectionManager.getMatchingPods(filter)
      namespaceSuggestions = SelectionManager.getMatchingNamespaces(filter)
    }
    this.setState({filterText: filter, podSuggestions, namespaceSuggestions})
  }

  getSuggestionValue = (item: KubeComponent) : string => {
    return item.name
  }

  onSuggestionsFetchRequested = ({value, reason}) => {
    value = reason === 'suggestion-selected' ? this.state.filterText : value
    const podSuggestions = SelectionManager.getMatchingPods(value)
    const namespaceSuggestions = SelectionManager.getMatchingNamespaces(value)
    this.setState({
      podSuggestions,
      namespaceSuggestions
    })
    if(value && value !== '') {
      this.props.onApplyFilter(value, namespaceSuggestions, podSuggestions)
    }
  }

  onInputChange = (event: SyntheticEvent, {newValue, method}) => {
    if(method !== 'click') {
      newValue = newValue || ''
      this.setState({filterText: newValue})
    }
  }

  onApply = () => {
    const {filterText, namespaceSuggestions, podSuggestions} = this.state
    this.props.onApplyFilter(filterText, namespaceSuggestions, podSuggestions)
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
          autoFocus
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
          {item instanceof Pod && 
            <span style={{ fontWeight: 300, float: 'right' }} className={classes.suggestionItem}>
              {item.namespace.name}
            </span>
          }
        </div>
      </MenuItem>
    )
  }

  render() {
    const { classes } = this.props
    const { filterText, podSuggestions, namespaceSuggestions } = this.state

    const inputProps = {
      placeholder: 'Search for namespaces and pods',
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

    let suggestions: any[] = [
      {
        title: "Namespaces",
        suggestions: namespaceSuggestions
      },
      {
        title: "Pods",
        suggestions: podSuggestions
      }
    ]
    return (
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
            {(podSuggestions.length > 0 || namespaceSuggestions.length > 0) &&
              <FormHelperText>
                The filter matches {namespaceSuggestions.length} Namespaces and {podSuggestions.length} Pod(s). 
              </FormHelperText>
            }
            {options.children}
          </Paper>
        )}
      />
    )
  }
}

export default withStyles(styles)(PodFilter)
