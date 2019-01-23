import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "List/Compare Secrets",
      order: 12,
      async act(actionContext) {
        this.showOutputLoading && this.showOutputLoading(true)
        const clusters = actionContext.getClusters()
        const namespaces = actionContext.getNamespaces()

        const secretsMap = {}
        const secretIndexToNameMap = {}
        for(const i in namespaces) {
          const namespace = namespaces[i]
          const nsCluster = namespace.cluster.name
          if(!secretsMap[namespace.name]) {
            secretsMap[namespace.name] = {}
          }
          const k8sClient = clusters.filter(cluster => cluster.name === nsCluster)
                                      .map(cluster => cluster.k8sClient)[0]
          const secrets = await k8sFunctions.getNamespaceSecrets(namespace.cluster.name, namespace.name, k8sClient)
          secrets.forEach(secret => {
            let secretIndexName = secret.name
            const firstDash = secret.name.indexOf('-') 
            const lastDash = secret.name.lastIndexOf('-')
            if(firstDash > 0 && lastDash > 0 && firstDash !== lastDash) {
              secretIndexName = secret.name.slice(0, lastDash)
            }
            if(!secretsMap[namespace.name][secretIndexName]) {
              secretsMap[namespace.name][secretIndexName] = {}
            }
            secretsMap[namespace.name][secretIndexName][nsCluster] = true
            secretIndexToNameMap[secretIndexName] = secret.name
          })
        }

        const output: ActionOutput = []
        const headers = ["Namespace/Secret"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        output.push(headers)
      
        Object.keys(secretsMap).forEach(namespace => {
          const groupTitle = [">Namespace: " + namespace]
          clusters.forEach(cluster => {
            groupTitle.push("")
          })
          output.push(groupTitle)
          const secretToClusterMap = secretsMap[namespace]
          const secrets = secretToClusterMap ? Object.keys(secretToClusterMap) : []
          if(secrets.length === 0) {
            output.push(["No Secrets", ...clusters.map(() => "")])
          } else {
            secrets.forEach(secretIndex => {
              const clusterMap = secretToClusterMap[secretIndex]
              const row = [secretIndexToNameMap[secretIndex]]
              clusters.forEach(cluster => {
                row.push(clusterMap[cluster.name] ? "Yes" : "No")
              })
              output.push(row)
            })
          }
        })
        this.onOutput && this.onOutput(output, ActionOutputStyle.Compare)
        this.showOutputLoading && this.showOutputLoading(false)
      },
    }
  ]
}

export default plugin
