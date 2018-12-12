"use strict";
const isNullOrUndefined = require('util').isNullOrUndefined
const k8sFunctions = require('../../k8s/k8sFunctions')

let items = {}

async function prepareChoices(actionContext, k8sFunction, name, min, max, ...fields) {
  const clusters = actionContext.getClusters()
  const k8sClients = actionContext.getK8sClients()
  const namespaces = actionContext.getNamespaces()
  items = {}
  const choices = []
  for(const i in namespaces) {
    const namespace = namespaces[i]
    const nsCluster = namespace.cluster.name
    if(!items[namespace.name]) {
      items[namespace.name] = []
    }

    const k8sClient = clusters.map((c,i) => c.name === nsCluster ? i : -1)
                              .filter(i => i >= 0).map(i => k8sClients[i])[0]
    
    items[namespace.name] = await k8sFunction(namespace.name, k8sClient)
    items[namespace.name].forEach(item => {
      const choiceItem = []
      if(fields.length > 0) {
        fields.forEach(field => choiceItem.push(item[field]))
      } else {
        choiceItem.push(item)
      }
      choiceItem.push("Namespace: " + namespace.name)
      choiceItem.push("Cluster: " + namespace.cluster.name)
      choices.push(choiceItem)
    })
  }
  let howMany = ""
  if(min === max && max > 0) {
    howMany = " " + max + " "
  } else {
    howMany = min > 0 ? " at least " + min : ""
    howMany += max > 0 && min > 0 ? ", and " : ""
    howMany += max > 0 ?  " up to " + max : ""
  }
  actionContext.onChoices("Choose" + howMany + name + " to compare", choices, min, max)
}

function prepareOutput(actionContext, name, ...fields) {
  let selections = actionContext.getSelections()
  if(selections.length < 2) {
    actionContext.onOutput(["No " + name + " selected"], 'Text')
    return
  }
  selections = selections.map(selection => {
    const data = {}
    let lastIndex = 0
    if(fields.length > 0) {
      fields.forEach((field, index) => {
        data[field] = selection[index]
        lastIndex++
      })
    } else {
      data.name = selection[0]
      lastIndex++
    }
    data.namespace = selection[lastIndex].replace("Namespace: ", "")
    data.cluster = selection[lastIndex+1].replace("Cluster: ", "")
    return data
  })
  let output = []
  const outputHeaders = ["Keys"]
  const outputRows = []
  outputRows.push(["Cluster"])
  outputRows.push(["Namespace"])

  const firstItem = items[selections[0].namespace][0]
  const outputKeys = typeof firstItem !== 'string' ? Object.keys(firstItem) : []
  outputKeys.forEach(key => outputRows.push([key]))

  selections.forEach(selection => 
    items[selection.namespace]
      .filter(item => (item.name || item) === selection.name)
      .forEach(item => {
        outputHeaders.push(item.name || item)
        outputRows[0].push(selection.cluster||'')
        outputRows[1].push(selection.namespace||'')
        if(typeof item !== 'string') {
          outputKeys.forEach((key, index) => outputRows[index+2].push(item[key] ||''))
        }
      }))
  outputRows.forEach((row,i) => {
    const hasAnyValue = row.slice(1).map(value => !isNullOrUndefined(value) && value !== '')
                              .reduce((r1,r2) => r1 || r2)
    if(!hasAnyValue) {
      delete outputRows[i]
    }
  })
  output.push(outputHeaders)
  output = output.concat(outputRows)
  actionContext.onOutput(output, "Compare")
}

module.exports = {
  title: "Namespace Objects",
  context: "Namespace",
  actions: [
    {
      name: "Compare Two Secrets",
      order: 2,
      secrets: {},
      async choose(actionContext) {
        await prepareChoices(actionContext, k8sFunctions.getNamespaceSecrets, "Secrets", 2, 2, "name")
      },

      async act(actionContext) {
        prepareOutput(actionContext, "Secrets", "name")
      },
    },
    {
      name: "Compare Two Services",
      order: 2,
      secrets: {},
      async choose(actionContext) {
        await prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        prepareOutput(actionContext, "Secrets")
      },
    }
  ]
}