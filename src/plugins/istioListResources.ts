import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import ActionContext from '../actions/actionContext';
import IstioPluginHelper from '../k8s/istioPluginHelper';

async function listResources(title: string, getResources: (k8sClient) => Promise<any[]>, 
                            onOutput, onStreamOutput, actionContext: ActionContext) {
  const clusters = actionContext.getClusters()
  onOutput([["", title]], ActionOutputStyle.Table)
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
    onStreamOutput(output)
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Recipes",
  actions: [
    {
      name: "List Gateways",
      order: 1,
      act(actionContext) {
        listResources("Istio Gateways List", IstioFunctions.listAllGateways, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List VirtualServices",
      order: 2,
      act(actionContext) {
        listResources("Istio VirtualServices List", IstioPluginHelper.getAllVirtualServices, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List DestinationRules",
      order: 3,
      act(actionContext) {
        listResources("Istio DestinationRules List", IstioFunctions.listAllDestinationRules, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List ServiceEntries",
      order: 4,
      act(actionContext) {
        listResources("Istio ServiceEntries List", IstioFunctions.listAllServiceEntries, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List EnvoyFilters",
      order: 5,
      act(actionContext) {
        listResources("Istio EnvoyFilters List", IstioFunctions.listAllEnvoyFilters, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Policies",
      order: 6,
      act(actionContext) {
        listResources("Istio Policies List", IstioFunctions.listAllPolicies, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List MeshPolicies",
      order: 7,
      act(actionContext) {
        listResources("Istio MeshPolicies List", IstioFunctions.listAllMeshPolicies, this.onOutput, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Rules",
      order: 8,
      act(actionContext) {
        listResources("Istio Rules List", IstioFunctions.listAllRules, this.onOutput, this.onStreamOutput, actionContext)
      }
    }
  ]
}

export default plugin
