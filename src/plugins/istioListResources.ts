import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import ActionContext from '../actions/actionContext';

async function listResources(title: string, getResources: (k8sClient) => Promise<any[]>,
                              actionContext: ActionContext) {
  const clusters = actionContext.getClusters()
  actionContext.onOutput && actionContext.onOutput([["", title]], ActionOutputStyle.Table)
  for(const i in clusters) {
    const cluster = clusters[i]
    const output: ActionOutput = []
    output.push([">Cluster: " + cluster.name, ""])

    const resources = await getResources(cluster.k8sClient)
    resources.length === 0 && output.push(["", "No resource found"])
    resources.forEach(resource => {
      output.push([">>" + (resource.name || ""), ""])
      Object.keys(resource).forEach(key => resource[key] && output.push([key, resource[key]]))
    })
    actionContext.onStreamOutput  && actionContext.onStreamOutput(output)
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "List Gateways",
      order: 1,
      act: listResources.bind(null, "Istio Gateways List", IstioFunctions.listAllGateways)
    },
    {
      name: "List VirtualServices",
      order: 2,
      
      act: listResources.bind(null, "Istio VirtualServices List", IstioFunctions.listAllVirtualServices)
    },
    {
      name: "List DestinationRules",
      order: 3,
      
      act: listResources.bind(null, "Istio DestinationRules List", IstioFunctions.listAllDestinationRules)
    },
    {
      name: "List ServiceEntries",
      order: 4,
      
      act: listResources.bind(null, "Istio ServiceEntries List", IstioFunctions.listAllServiceEntries)
    },
    {
      name: "List EnvoyFilters",
      order: 5,
      
      act: listResources.bind(null, "Istio EnvoyFilters List", IstioFunctions.listAllEnvoyFilters)
    },
    {
      name: "List Policies",
      order: 6,
      
      act: listResources.bind(null, "Istio Policies List", IstioFunctions.listAllPolicies)
    },
    {
      name: "List MeshPolicies",
      order: 7,
      
      act: listResources.bind(null, "Istio MeshPolicies List", IstioFunctions.listAllMeshPolicies)
    },
    {
      name: "List Rules",
      order: 8,
      
      act: listResources.bind(null, "Istio Rules List", IstioFunctions.listAllRules)
    }
  ]
}

export default plugin
