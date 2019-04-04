import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioFunctions from '../k8s/istioFunctions';
import {listResources} from './istioResources'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Sidecars Recipes",
  actions: [
    {
      name: "List Sidecar Proxies",
      order: 45,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Sidecars List"]], ActionOutputStyle.Table)
        listResources("Sidecars", IstioFunctions.getAllSidecars, this.onStreamOutput, actionContext)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Sidecar Injection Report",
      order: 46,
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        this.onOutput && this.onOutput([["", "Sidecar Injection Report"]], ActionOutputStyle.Table)

        this.showOutputLoading && this.showOutputLoading(true)
        for(const cluster of clusters) {
          this.onStreamOutput  && this.onStreamOutput([[">Cluster: " + cluster.name, ""]])
          if(!cluster.hasIstio) {
            this.onStreamOutput  && this.onStreamOutput([["", "Istio not installed"]])
            continue
          }

          let output: ActionOutput = []
          output.push([">>Namespace", "Sidecar Injection Status"])
      
          const namespaces = await K8sFunctions.getClusterNamespaces(cluster.k8sClient)
          namespaces.length === 0 && output.push(["", "No namespaces found"])
          namespaces.forEach(namespace => {
            const isSidecarInjectionEnabled = namespace.labels && Object.keys(namespace.labels)
                                              .filter(l => l.includes("istio-injection"))
                                              .filter(l => namespace.labels[l].includes("enabled")).length > 0
            output.push([namespace.name, isSidecarInjectionEnabled ? "Enabled" : "Disabled"])
          })
          this.onStreamOutput && this.onStreamOutput(output)

          output = []
          for(const namespace of namespaces) {
            const deployments = (await K8sFunctions.getNamespaceDeployments(cluster.name, namespace.name, cluster.k8sClient))
                                  .filter(d => d.template.annotations && 
                                    d.template.annotations.filter(a => a.includes("sidecar.istio.io/inject"))
                                    .length > 0
                                  )
            if(deployments.length > 0) {
              output.push([">Sidecar Injection overrides for Namespace: " + namespace.name, ""])
              deployments.forEach(d => {
                const sidecarInjectionAnnotation = d.template.annotations && 
                                d.template.annotations.filter(a => a.includes("sidecar.istio.io/inject"))
                if(sidecarInjectionAnnotation && sidecarInjectionAnnotation.length > 0) {
                  output.push([d.name, sidecarInjectionAnnotation[0]])
                }
              })
            }
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
