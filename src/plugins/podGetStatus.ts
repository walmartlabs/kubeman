import K8sPluginHelper from '../../src/util/k8sPluginHelper'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../../src/actions/actionSpec'
import { PodDetails } from '../../src/k8s/k8sObjectTypes';

type ClusterNamespacePodsMap = {[cluster: string]: {[namespace: string]: PodDetails[]}}

const plugin : ActionGroupSpec = {
  context: ActionContextType.Namespace,
  title: "Pod Actions",
  actions: [
    {
      name: "View Pod(s) Status",
      order: 2,

      choose: K8sPluginHelper.choosePod.bind(null, 1, 10, false, false),

      async act(actionContext) {
        const selections = await K8sPluginHelper.getPodSelections(actionContext, true, false)
        if(selections.length < 1) {
          actionContext.onOutput && actionContext.onOutput([["No pod selected"]], ActionOutputStyle.Text)
          return
        }
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
        output.push(["Pod", "Created", "Container Status"])
      
        Object.keys(podsMap).forEach(cluster => {
          output.push([">Cluster: "+cluster, "", ""])
      
          const namespaces = Object.keys(podsMap[cluster])
          namespaces.forEach(namespace => {
            output.push([">>Namespace: "+namespace, "", ""])
      
            const pods = podsMap[cluster][namespace]
            if(pods.length === 0) {
              output.push(["No pods selected", "", ""])
            } else {
              pods.forEach(pod => {
                output.push([pod.name, pod.creationTimestamp, pod.containerStatuses])
              })
            }
          })
        })
        actionContext.onOutput && actionContext.onOutput(output, ActionOutputStyle.Table)
      }
    }
  ]
}

export default plugin
