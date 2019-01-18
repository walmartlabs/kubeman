import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import ActionContext from '../actions/actionContext';
import IstioPluginHelper from '../k8s/istioPluginHelper';
import K8sPluginHelper from '../k8s/k8sPluginHelper';

export async function listResources(type: string, getResources: (k8sClient) => Promise<any[]>, 
                              onStreamOutput, actionContext: ActionContext) {
  const clusters = actionContext.getClusters()

  for(const cluster of clusters) {
    const output: ActionOutput = []
    output.push([">"+type+" @ Cluster: " + cluster.name, ""])

    if(cluster.hasIstio) {
      const resources = await getResources(cluster.k8sClient)
      resources.length === 0 && output.push(["", "No resource found"])
      resources.forEach(resource => {
        output.push([">>" + (resource.name || ""), ""])
        Object.keys(resource).forEach(key => resource[key] && output.push([key, resource[key]]))
      })
    } else {
      output.push(["", "Istio not installed"])
    }
    onStreamOutput(output)
  }
}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Istio Resource Lists",
  order: ActionContextOrder[ActionContextType.Istio],
  actions: [
    {
      name: "List Gateways",
      order: 1,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Gateways List"]], ActionOutputStyle.Table)
        listResources("Gateways", IstioFunctions.listAllGateways, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List VirtualServices",
      order: 2,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio VirtualServices List"]], ActionOutputStyle.Table)
        listResources("VirtualServices", IstioPluginHelper.getAllVirtualServices, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List DestinationRules",
      order: 3,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio VirtualServices List"]], ActionOutputStyle.Table)
        listResources("VirtualServices", IstioFunctions.listAllDestinationRules, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List ServiceEntries",
      order: 4,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio ServiceEntries List"]], ActionOutputStyle.Table)
        listResources("ServiceEntries", IstioFunctions.listAllServiceEntries, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Policies",
      order: 6,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Policies List"]], ActionOutputStyle.Table)
        listResources("Policies", IstioFunctions.listAllPolicies, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List MeshPolicies",
      order: 7,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio MeshPolicies List"]], ActionOutputStyle.Table)
        listResources("MeshPolicies", IstioFunctions.listAllMeshPolicies, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Rules",
      order: 8,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Rules List"]], ActionOutputStyle.Table)
        listResources("Rules", IstioFunctions.listAllRules, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Any CRD",
      order: 9,
      async choose(actionContext) {
        const clustersReported: string[] = []
        await K8sPluginHelper.prepareChoices(actionContext, 
          async (cluster, namespace,k8sClient) => {
            if(!clustersReported.includes(cluster)) {
              clustersReported.push(cluster)
              return k8sClient.istio ? k8sClient.istio.crds : []
            } else {
              return []
            }
          }, "Istio Custom Resources", 1, 10)
      },
      async act(actionContext) {
        const selections = await K8sPluginHelper.getSelections(actionContext)
        const resources = selections.map(s =>  s.name.split(".")[0])
        this.onOutput && this.onOutput([["Istio Resources:", resources.join(", ")]], ActionOutputStyle.Table)
        resources.forEach(r => {
          listResources(r, IstioFunctions.listAnyResource.bind(IstioFunctions, r), this.onStreamOutput, actionContext)
        })
      }
    }
  ]
}

export default plugin
