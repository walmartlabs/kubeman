import {Cluster, Namespace, Pod, Item} from "./k8s/k8sObjectTypes";
import Context from "./context/contextStore";
import * as k8s from './k8s/k8sContextClient'

const maxPods = 10
const maxPerNS = 2
let countAdded = 0

const preferredPodNames = [
  "controller", "ingress", "pilot", "policy", "tools", "nginx", "tax", "pos"
]

async function addCluster(context: Context, clusterName: string, ...namespaces) {
  const cluster = new Cluster(clusterName)
  await context.addCluster(cluster)

  for(const i in namespaces) {
    const namespace = new Namespace(namespaces[i], cluster)
    context.addNamespace(namespace)
    if(countAdded < maxPods) {
      let countAddedForNS = 0
      const pods = await k8s.getPodsForNamespace(namespace)
      pods.forEach((pod,i) => {
        if(preferredPodNames.filter(text => pod.name.includes(text)).length > 0) {
          if(countAddedForNS < maxPerNS && countAdded < maxPods) {
            context.addPod(pod)
            countAddedForNS++
            countAdded++
          }
        }
      })
    }
  } 
}

export async function setupRealContext(context: Context) : Promise<Context> {
  await addCluster(context, "docker-for-desktop-cluster", "istio-system", "default", "tools", "local")
  //await addCluster(context, "vsh01.s05518.us/labs/cluster1", "istio-system", "cpc-offline")
  //await addCluster(context, "vsh01.s05542.us/labs/cluster1", "istio-system", "cpc-offline")
  //await addCluster(context, "eastus2/dev/af1", "istio-system")
  //await addCluster(context, "eastus2/dev/af5", "istio-system")

  return Promise.resolve(context)
}
