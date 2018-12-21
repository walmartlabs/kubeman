import {ActionGroupSpec, ActionContextType, ActionOutputStyle} from '../../src/actions/actionSpec'
import ActionContext from '../../src/actions/actionContext'
import k8sFunctions from '../../src/k8s/k8sFunctions'
import {generateDeploymentComparisonOutput} from './namespaceCompareDeployments'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "List/Compare Deployments",
      order: 6,
      async act(actionContext: ActionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()

        if(clusters.length < 2 || k8sClients.length < 2) {
          actionContext.onOutput && 
            actionContext.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }

        const deployments = await k8sFunctions.getDeploymentsGroupedByClusterNamespace(clusters, k8sClients)
        const namespaces : any[] = []
        Object.keys(deployments).map(cluster => Object.keys(deployments[cluster]))
        .forEach(cnamespaces => cnamespaces.forEach(namespace => 
          namespaces.push({name: namespace})))

        const output = generateDeploymentComparisonOutput(clusters, namespaces, deployments)
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    },
  ]
}

export default plugin