import K8sPluginHelper from '../k8s/k8sPluginHelper'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import { PodDetails } from '../k8s/k8sObjectTypes';

type ClusterNamespacePodsMap = {[cluster: string]: {[namespace: string]: PodDetails[]}}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Recipes",
  actions: [
    {
      name: "View Pod(s) Status",
      order: 2,
      autoRefreshDelay: 15,
      loadingMessage: "Loading Pods...",

      choose: K8sPluginHelper.choosePod.bind(K8sPluginHelper, 1, 10, false, false),

      async act(actionContext) {
        this.onOutput && this.onOutput([["Pod", "Status"]], ActionOutputStyle.Table)
        this.showOutputLoading && this.showOutputLoading(true)

        const selections = await K8sPluginHelper.getPodSelections(actionContext, true, false)
        const podsMap : ClusterNamespacePodsMap = {}
        for(const i in selections) {
          const selection = selections[i]
          const pod = selection.pod
          const namespace = selection.namespace
          const cluster = selection.cluster
          const podDetails = selection.podContainerDetails as PodDetails
        
          !podsMap[cluster] && (podsMap[cluster] = {})
          !podsMap[cluster][namespace] && (podsMap[cluster][namespace] = [])
          podsMap[cluster][namespace].push(podDetails)
        }
        const output: ActionOutput = []
      
        Object.keys(podsMap).forEach(cluster => {
          output.push([">Cluster: "+cluster, ""])
      
          const namespaces = Object.keys(podsMap[cluster])
          namespaces.forEach(namespace => {
            output.push([">>Namespace: "+namespace, ""])
      
            const pods = podsMap[cluster][namespace]
            if(pods.length === 0) {
              output.push(["No pods selected", ])
            } else {
              pods.forEach(pod => {
                output.push([pod.name, ["Created: "+pod.creationTimestamp, 
                                        pod.conditions, pod.containerStatuses]])
              })
            }
          })
        })
        this.onStreamOutput && this.onStreamOutput(output)
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
