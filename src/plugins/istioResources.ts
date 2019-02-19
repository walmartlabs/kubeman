import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import IstioFunctions from '../k8s/istioFunctions';
import ActionContext from '../actions/actionContext';
import IstioPluginHelper from '../k8s/istioPluginHelper';
import ChoiceManager from '../actions/choiceManager';

export async function listResources(type: string, getResources: (k8sClient) => Promise<any[]>, 
                              onStreamOutput, actionContext: ActionContext, clusterName?: string) {
  const clusters = actionContext.getClusters()

  for(const cluster of clusters) {
    if(clusterName && cluster.name !== clusterName) {
      continue
    }
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
  title: "Resources",
  order: ActionContextOrder.Resources,
  actions: [
    {
      name: "List Gateways",
      order: 11,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Gateways List"]], ActionOutputStyle.Table)
        listResources("Gateways", IstioFunctions.listAllGateways, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List VirtualServices",
      order: 12,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio VirtualServices List"]], ActionOutputStyle.Table)
        listResources("VirtualServices", IstioFunctions.listAllVirtualServices, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List DestinationRules",
      order: 13,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio VirtualServices List"]], ActionOutputStyle.Table)
        listResources("VirtualServices", IstioFunctions.listAllDestinationRules, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List ServiceEntries",
      order: 14,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio ServiceEntries List"]], ActionOutputStyle.Table)
        listResources("ServiceEntries", IstioFunctions.listAllServiceEntries, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Policies",
      order: 15,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Policies List"]], ActionOutputStyle.Table)
        listResources("Policies", IstioFunctions.listAllPolicies, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List MeshPolicies",
      order: 16,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio MeshPolicies List"]], ActionOutputStyle.Table)
        listResources("MeshPolicies", IstioFunctions.listAllMeshPolicies, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "List Rules",
      order: 17,
      act(actionContext) {
        this.onOutput && this.onOutput([["", "Istio Rules List"]], ActionOutputStyle.Table)
        listResources("Rules", IstioFunctions.listAllRules, this.onStreamOutput, actionContext)
      }
    },
    {
      name: "Istio CRD Resource Instances",
      order: 20,
      loadingMessage: "Loading CRDs...",

      choose: IstioPluginHelper.chooseIstioCRDs.bind(IstioPluginHelper, 1, 10),

      async act(actionContext) {
        const selections = await ChoiceManager.getSelections(actionContext)
        const resources = selections.map(s =>  s.name.split(".")[0])
        this.onOutput && this.onOutput([["Istio Resources:", resources.join(", ")]], ActionOutputStyle.Table)
        for(const i in selections) {
          await listResources(resources[i], IstioFunctions.listAnyResource.bind(IstioFunctions, resources[i]), 
                            this.onStreamOutput, actionContext, selections[i].cluster)
        }
      }
    }
  ]
}

export default plugin
