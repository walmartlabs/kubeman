import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import JsonUtil from '../util/jsonUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Get Nodes Details",
      order: 2,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([[
          ["Node", "(CreationTime)"],
          "Info",
          "Conditions",
        ]], ActionOutputStyle.TableWithHealth)
        this.showOutputLoading && this.showOutputLoading(true)

        for(const i in clusters) {
          const output: ActionOutput = []
          const cluster = clusters[i]
          output.push([">Cluster: " + cluster.name, "", ""])
          const nodes = await k8sFunctions.getClusterNodes(cluster.name, cluster.k8sClient)
          if(nodes.length > 0) {
            output.push([">>>Cluster URL: " + nodes[0].baseUrl, "", ""])
          }
          nodes.forEach(node => {
            const nodeInfo = JsonUtil.flattenObject(node.info)
            output.push([
              [node.name, "(" + node.creationTimestamp + ")"],
              Object.keys(node.network)
                    .map(key => key + ": " + node.network[key])
                    .concat(Object.keys(nodeInfo)
                        .map(key => key + ": " + nodeInfo[key])),
              Object.keys(node.condition).map(key => 
                    key + ": " + node.condition[key].status +
                    " (" + node.condition[key].message + ")"),
            ])
          })
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
    },
  ]
}

export default plugin
