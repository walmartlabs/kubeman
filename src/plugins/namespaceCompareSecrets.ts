import k8sFunctions from '../../src/k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  actions: [
    {
      name: "Compare Secrets",
      order: 2,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const k8sClients = actionContext.getK8sClients()
        const namespaces = actionContext.getNamespaces()

        const secretsMap = {}

        for(const i in namespaces) {
          const namespace = namespaces[i]
          const nsCluster = namespace.cluster.name
          if(!secretsMap[namespace.name]) {
            secretsMap[namespace.name] = {}
          }

          const k8sClient = clusters.map((c,i) => c.name === nsCluster ? i : -1)
                                    .filter(i => i >= 0).map(i => k8sClients[i])[0]
          
          const secrets = await k8sFunctions.getNamespaceSecrets(namespace.cluster.name, namespace.name, k8sClient)
          secrets.forEach(secret => {
            secret.name = secret.name.slice(0, secret.name.lastIndexOf('-'))
            if(!secretsMap[namespace.name][secret.name]) {
              secretsMap[namespace.name][secret.name] = {}
            }
            secretsMap[namespace.name][secret.name][nsCluster] = true
          })
        }

        const output: ActionOutput = []
        const headers = ["Namespace/Secret"]
        clusters.forEach(cluster => {
          headers.push("Cluster: " + cluster.name)
        })
        output.push(headers)
      
        Object.keys(secretsMap).forEach(namespace => {
          output.push(["Namespace: " + namespace, "---", "---"])
          const secretToClusterMap = secretsMap[namespace]
          const secrets = secretToClusterMap ? Object.keys(secretToClusterMap) : []
          if(secrets.length === 0) {
            output.push(["No Secrets", "", ""])
          } else {
            secrets.forEach(secret => {
              const clusterMap = secretToClusterMap[secret]
              const row = [secret]
              clusters.forEach(cluster => {
                row.push(clusterMap[cluster.name] ? "Yes" : "No")
              })
              output.push(row)
            })
          }
        })
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Compare)
      },
    }
  ]
}

export default plugin
