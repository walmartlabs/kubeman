import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import IstioPluginHelper from '../k8s/istioPluginHelper'

const comparisonMap = {}

function addKeyComparison(key: string, objects: any[]) {
  comparisonMap[key] = []
  objects.forEach(o => comparisonMap[key].push(o[key]))
}

async function compareDeployment(actionContext: ActionContext) {
  const clusters = actionContext.getClusters()
  const ingressDeployments: any[] = []
  for(const i in clusters) {
    const cluster = clusters[i]
    const k8sClient = cluster.k8sClient
    const ingressDeployment = await K8sFunctions.getDeploymentDetails(cluster.name, 
                                "istio-system", "istio-ingressgateway", k8sClient)
    if(!ingressDeployment) {
      actionContext.onStreamOutput && actionContext.onStreamOutput(["istio-ingressgateway not found", ""])
    } else {
      ingressDeployments.push(ingressDeployment)
    }
  }

  addKeyComparison("replicas", ingressDeployments)
  addKeyComparison("availableReplicas", ingressDeployments.map(d => d.status))
  addKeyComparison("readyReplicas", ingressDeployments.map(d => d.status))
  const proxyContainers = ingressDeployments.map(deployment => 
    deployment.template.containers.filter(c => c.name === "istio-proxy" || c.name === 'ingressgateway')[0]||{})
  addKeyComparison("image", proxyContainers)
  addKeyComparison("ports", proxyContainers)
  addKeyComparison("resources", proxyContainers)
  
  const volumesAndMounts = ingressDeployments.map((deployment, i) => {
    return deployment.template.volumes ? {
      volumes:deployment.template.volumes.map(volume => {
        return {
          volume: volume.name,
          secret: volume.secret.secretName,
          mountPath: proxyContainers[i].volumeMounts ? 
                      proxyContainers[i].volumeMounts.filter(mount => mount.name === volume.name)
                        .map(mount => mount.mountPath).join(" ") : ""
        }}) 
      } : {}
  })
  addKeyComparison("volumes", volumesAndMounts)
}

async function compareIngressComponents(actionContext: ActionContext) {
  const clusters = actionContext.getClusters()

  comparisonMap["Ingress Service"] = []
  comparisonMap["Ingress Pods"] = []
  comparisonMap["Ingress Gateways"] = []
  comparisonMap["Ingress VirtualServices"] = []
  for(const i in clusters) {
    const cluster = clusters[i]
    const k8sClient = cluster.k8sClient
    comparisonMap["Ingress Service"].push(await IstioPluginHelper.getIstioServiceDetails("istio=ingressgateway", k8sClient))
    comparisonMap["Ingress Pods"].push(await IstioPluginHelper.getIstioServicePods("istio=ingressgateway", k8sClient))
    comparisonMap["Ingress Gateways"].push(await IstioPluginHelper.getIstioIngressGateways(k8sClient))
    comparisonMap["Ingress VirtualServices"].push(await IstioPluginHelper.getIstioIngressVirtualServices(k8sClient))
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "Compare Ingress",
      order: 11,
      
      async act(actionContext) {
        const clusters = actionContext.getClusters()
        const headers = ["Istio IngressGateway Details"]
        clusters.forEach(cluster => headers.push(cluster.name))
        actionContext.onOutput &&
          actionContext.onOutput([headers], ActionOutputStyle.Compare)

        await compareDeployment(actionContext)
        await compareIngressComponents(actionContext)

        const rows: any[][] = []
        Object.keys(comparisonMap).forEach(key => {
          const row: any[] = []
          row.push(key)
          comparisonMap[key].forEach(value => row.push(value))
          rows.push(row)
        })
        actionContext.onStreamOutput && actionContext.onStreamOutput(rows)
      },
    }
  ]
}

export default plugin
