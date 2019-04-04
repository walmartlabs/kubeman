import k8sFunctions from '../k8s/k8sFunctions'
import {ActionGroupSpec, ActionContextType, 
        ActionOutput, ActionOutputStyle, } from '../actions/actionSpec'
import JsonUtil from '../util/jsonUtil';

const plugin : ActionGroupSpec = {
  context: ActionContextType.Cluster,
  actions: [
    {
      name: "Find Component By IP",
      order: 15,
      async act(actionContext) {
        this.clear && this.clear(actionContext)
      },
      clear() {
        this.onOutput && this.onOutput([[
          "Enter /<ip address>,<ip address>... as command to find components by IP",
        ]], ActionOutputStyle.Table)
      },
      async react(actionContext) {
        this.onOutput && this.onOutput([[
          "Component", "Cluster", "Namespace", "IP"
        ]], ActionOutputStyle.Table)

        const ipAddresses = actionContext.inputText ? actionContext.inputText.split(",").map(value => value.trim()) : []
        let countIPToFind = ipAddresses.length
        const clusters = actionContext.getClusters()
        for(const cluster of clusters) {
          this.onStreamOutput && this.onStreamOutput([[">Cluster: " + cluster.name, "", "", ""]])
          const nodes = await k8sFunctions.getClusterNodes(cluster.name, cluster.k8sClient)
          const matchingNodes = nodes.filter(node => Object.values(node.network).filter(value => 
                                    ipAddresses.includes(value ? value.toString() : '')).length > 0)
          if(matchingNodes.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Nodes", "", "", ""]])
            matchingNodes.forEach(node => {
              this.onStreamOutput && this.onStreamOutput([[
                node.name, cluster.name, "", node.network
              ]])
            })
            countIPToFind -= matchingNodes.length
            if(countIPToFind === 0) {
              return
            }
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Nodes", "", "", ""]])
          }

          const services = await k8sFunctions.getServices(cluster.name, undefined, cluster.k8sClient)
          const matchingServices = services.filter(s => ipAddresses.includes(s.clusterIP))
          if(matchingServices.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Services", "", "", ""]])
            matchingServices.forEach(service => {
              this.onStreamOutput && this.onStreamOutput([[
                service.name, cluster.name, service.namespace, {clusterIP: service.clusterIP}
              ]])
            })
            countIPToFind -= matchingServices.length
            if(countIPToFind === 0) {
              return
            }
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Services", "", "", ""]])
          }

          const pods = await k8sFunctions.getAllClusterPods(cluster.k8sClient)
          const matchingPods = pods.filter(pod => ipAddresses.includes(pod.podIP))
          if(matchingPods.length > 0) {
            this.onStreamOutput && this.onStreamOutput([[">>Pods", "", "", ""]])
            matchingPods.forEach(pod => {
              this.onStreamOutput && this.onStreamOutput([[
                pod.name, cluster.name, pod.namespace, {podIP: pod.podIP, hostIP: pod.hostIP, nodeName: pod.nodeName}
              ]])
            })
            countIPToFind -= matchingPods.length
            if(countIPToFind === 0) {
              return
            }
          } else {
            this.onStreamOutput && this.onStreamOutput([[">>No Matching Pods", "", "", ""]])
          }
        }
      },
    },
  ]
}

export default plugin
