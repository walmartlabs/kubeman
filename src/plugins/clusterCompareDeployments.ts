import {ActionGroupSpec, ActionContextType, ActionOutputStyle} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import k8sFunctions from '../k8s/k8sFunctions'
import K8sPluginHelper from '../k8s/k8sPluginHelper'
import {generateDeploymentComparisonOutput} from './namespaceCompareDeployments'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Compare Deployments",
      order: 6,
      
      choose: K8sPluginHelper.chooseClusters,

      async act(actionContext: ActionContext) {
        const clusters = K8sPluginHelper.getSelectedClusters(actionContext)
        if(clusters.length < 2) {
          this.onOutput && this.onOutput([["Not enough clusters to compare"]], ActionOutputStyle.Text)
          return
        }
        const deployments = await k8sFunctions.getDeploymentsGroupedByClusterNamespace(clusters)
        const namespaces : any[] = []
        Object.keys(deployments).map(cluster => Object.keys(deployments[cluster]))
        .forEach(cnamespaces => cnamespaces.forEach(namespace => 
          namespaces.push({name: namespace})))

        const output = generateDeploymentComparisonOutput(clusters, namespaces, deployments)
        this.onOutput && this.onOutput(output, ActionOutputStyle.Compare)
      },
    },
  ]
}

export default plugin