import React, {SyntheticEvent} from 'react';
import Autosuggest from 'react-autosuggest'
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

import { withStyles, WithStyles } from '@material-ui/core/styles'
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import { Button, Input, InputAdornment, FormHelperText, FormGroup,
      FormControlLabel, Checkbox } from '@material-ui/core';

import {Pod, Namespace, KubeComponent} from "../k8s/k8sObjectTypes";
import SelectionManager from './selectionManager'

import styles from './selectionFilter.styles'


interface SelectionFilterProps extends WithStyles<typeof styles> {
  filter: string
  onApplyFilter: (string, []: Namespace[], []: Pod[]) => void
}

interface SelectionFilterState {
  includePods: boolean
  podSuggestions: Pod[]
  namespaceSuggestions: Namespace[]
  filterText: string
}

export class SelectionFilter extends React.Component<SelectionFilterProps, SelectionFilterState> {
  state: SelectionFilterState = {
    includePods: false,
    podSuggestions: [],
    namespaceSuggestions: [],
    filterText: '',
  }

  componentDidMount() {
    this.componentWillReceiveProps(this.props)
  }

  async componentWillReceiveProps(props: SelectionFilterProps) {
    const {filter} = props
    const {includePods} = this.state
    this.setState({filterText: filter})
    if(filter && filter !== '') {
      const matches = await SelectionManager.getMatchingNamespacesAndPods(filter, includePods)
      this.setState({podSuggestions: matches.pods, namespaceSuggestions: matches.namespaces})
    }
  }

  getSelections() {
    const {filterText, podSuggestions, namespaceSuggestions} = this.state
    return {pods: podSuggestions, namespaces: namespaceSuggestions, filterText}
  }

  getSuggestionValue = (item: KubeComponent) : string => {
    return item.name
  }

  onSuggestionsFetchRequested = async ({value, reason}) => {
    const {includePods} = this.state
    value = reason === 'suggestion-selected' ? this.state.filterText : value
    const matches = await SelectionManager.getMatchingNamespacesAndPods(value, includePods)
    this.setState({
      podSuggestions: matches.pods, 
      namespaceSuggestions: matches.namespaces
    })
  }

  onInputChange = (event: SyntheticEvent, {newValue, method}) => {
    if(method !== 'click') {
      newValue = newValue || ''
      this.setState({filterText: newValue})
    }
  }

  onIncludePods = async (event) => {
    const includePods = event.target.checked
    const matches = await SelectionManager.getMatchingNamespacesAndPods(this.state.filterText, includePods)
    this.setState({
      includePods, 
      podSuggestions: matches.pods, 
      namespaceSuggestions: matches.namespaces
    })
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
          {item instanceof Namespace && 
            <span style={{ fontWeight: 300, float: 'right' }} className={classes.suggestionItem}>
              {item.cluster.name}
            </span>
          }
          {item instanceof Pod && 
            <span style={{ fontWeight: 300, float: 'right' }} className={classes.suggestionItem}>
              {item.namespace.name+"@"+item.namespace.cluster.name}
            </span>
          }
        </div>
      </MenuItem>
    )
  }

  render() {
    const { classes } = this.props
    const { filterText, podSuggestions, namespaceSuggestions, includePods } = this.state

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
    let suggestions: any[] = []
    if(namespaceSuggestions.length > 0) {
      suggestions.push({
        title: "Namespaces",
        suggestions: namespaceSuggestions
      })
    }
    if(includePods && podSuggestions.length > 0) {
      suggestions.push({
        title: "Pods",
        suggestions: podSuggestions
      })
    }
    
    return (
      <div>
        {/* <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                checked={this.state.includePods}
                onChange={this.onIncludePods}
              />
            }
            label="Include Pods"
          />
        </FormGroup> */}
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
      </div>
    )
  }
}

export default withStyles(styles)(SelectionFilter)
