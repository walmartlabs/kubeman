import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions';
import IstioFunctions from '../k8s/istioFunctions';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  actions: [
    {
      name: "List Envoy Proxies",
      order: 1,
      async act(actionContext) {
        this.onOutput && this.onOutput([["", "Envoy Proxies List"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          const output: ActionOutput = []
          output.push([">Envoy Proxies @ Cluster: " + cluster.name, ""])
      
          if(cluster.hasIstio) {
            const sidecars = await IstioFunctions.getAllSidecars(cluster.k8sClient)
            sidecars.length === 0 && output.push(["", "No envoy proxies found"])
            sidecars.forEach(sc => {
              output.push([">>" + sc.pod+"."+sc.namespace, ""])
              output.push(["IP", sc.ip])
            })
          } else {
            output.push(["", "Istio not installed"])
          }
          this.onStreamOutput && this.onStreamOutput(output)
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    },
    {
      name: "Envoy Sidecar Injection Report",
      order: 2,
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
