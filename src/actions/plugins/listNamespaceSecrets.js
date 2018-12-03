const jp = require('jsonpath')

module.exports = {
  order: 3,
  context: "Namespace",
  actions: [
    {
      name: "List Secrets",
      async act(getClusters, getK8sClients, getNamespaces, onOutput) {
      },
    }
  ]
}