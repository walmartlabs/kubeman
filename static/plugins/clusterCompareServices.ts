import k8sFunctions from '../util/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'
import {generateServiceComparisonOutput} from './namespaceCompareServices'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Compare Services",
      order: 5,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()

        if(clusters.length < 2 || k8sClients.length < 2) {
          actionContext.onOutput && actionContext.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }

        const clusterServices = await k8sFunctions.getServicesGroupedByClusterNamespace(clusters, k8sClients)
        const namespaces: any[] = []
        Object.keys(clusterServices).map(cluster => Object.keys(clusterServices[cluster]))
        .forEach(cnamespaces => cnamespaces.forEach(namespace => 
          namespaces.push({name: namespace})))

        const output: ActionOutput = generateServiceComparisonOutput(clusters, namespaces, clusterServices)
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    },
  ]
}

export default plugin
