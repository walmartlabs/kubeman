const CommonFunctions = require('../../k8s/commonFunctions')

module.exports = {
  order: 2,
  context: "Cluster",
  actions: [
    {
      name: "Get Nodes Details",
      order: 4,
      async act(getClusters, getK8sClients, onOutput) {
        const clusters = getClusters()
        const k8sClients = getK8sClients()
        const output = []
        output.push([
          "Node <br/> (CreationTime)",
          "Info",
          "Conditions",
        ])
        for(const i in clusters) {
          const cluster = clusters[i].name
          output.push(["Cluster: " + cluster, "---", "---"])
          const nodes = await CommonFunctions.getClusterNodes(cluster, k8sClients[i])
          nodes.forEach(node => output.push([
            node.name + " <br/> (" + node.creationTimestamp + ")", 
            Object.keys(node.network).map(key => key+":"+JSON.stringify(node.network[key]))
            .concat(Object.keys(node.info).map(key => key+":"+JSON.stringify(node.info[key]))),
            Object.keys(node.condition).map(key => key+":"+JSON.stringify(node.condition[key])),
          ]))
        }
        onOutput(output, 'Table')
      },
    },
  ]
}