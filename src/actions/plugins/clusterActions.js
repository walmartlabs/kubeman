const jp = require('jsonpath')
const _ = require('lodash')
const jpExtract = require('../../util/jpExtract')

async function getNamespacesForCluster(cluster, k8sClient, output) {
  output.push(["Cluster: " + cluster, "---", "---"])
  const namespaces = await k8sClient.namespaces.get()
  if(namespaces && namespaces.body) {
    const items = namespaces.body.items
    const meta = jpExtract.extract(items, "$[*].metadata", "name", "creationTimestamp")
    const status = jpExtract.extract(items, "$[*].status", "phase")
    meta.forEach((item, index) => {
      output.push([
        item.name, 
        item.creationTimestamp,
        status[index].phase
      ])
    })
  }
}

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      name: "List Namespaces",
      async act(getClusters, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const output = []
        output.push([
          "Namespace", 
          "Created",
          "Status"
        ])
        for(let i = 0; i < clusters.length; i++) {
          await getNamespacesForCluster(clusters[i], k8sClients[i], output)
        }
        onOutput(output, 'Health')
      },
    }
  ]
}