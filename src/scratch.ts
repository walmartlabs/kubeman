import {Cluster, Namespace, Pod, Item} from "./k8s/k8sObjectTypes";
import Context from "./context/contextStore";
import * as k8s from './k8s/k8sContextClient'
import * as jp from 'jsonpath'
import jsonUtil from './util/jsonUtil'


export async function setupRealContext(context: Context) : Promise<Context> {
  const clusters = [
    new Cluster("docker-for-desktop-cluster")
  ]
  clusters.forEach(c => context.addCluster(c))

  const namespaces = [
    new Namespace("istio-system", clusters[0]), 
    new Namespace("kube-system", clusters[0]), 
  ]
  namespaces.forEach(ns => context.addNamespace(ns))


  let maxPods = 5
  for(const i in namespaces) {
    const ns = namespaces[i]
    const pods = await k8s.getPodsForNamespace(ns)
    maxPods > 1 ? maxPods-- : maxPods++
    let countAdded = 0
    pods.forEach((pod,i) => {
      //if(pod.name.includes("controller") || pod.name.includes("gress") || pod.name.includes("istio")) 
        if(countAdded < maxPods) {
          context.addPod(pod)
          countAdded++
        }
    })
  }
  return Promise.resolve(context)
}

export function createTestData(context: Context) : Context {
  const c1 = new Cluster("cluster-1")
  const c2 = new Cluster("cluster-2")
  context.addCluster(c1)
  context.addCluster(c2)

  const ns11 = new Namespace("some-junk-namespace-11", c1)
  const ns12 = new Namespace("some-junk-namespace-12", c1)
  const ns13 = new Namespace("some-junk-namespace-13", c1)
  const ns14 = new Namespace("some-junk-namespace-14", c1)
  const ns15 = new Namespace("some-junk-namespace-15", c1)
  context.addNamespace(ns11)
  context.addNamespace(ns12)
  context.addNamespace(ns13)
  context.addNamespace(ns14)
  context.addNamespace(ns15)

  const ns21 = new Namespace("some-junk-namespace-21", c2)
  const ns22 = new Namespace("some-junk-namespace-22", c2)
  const ns23 = new Namespace("some-junk-namespace-23", c2)
  const ns24 = new Namespace("some-junk-namespace-24", c2)
  const ns25 = new Namespace("some-junk-namespace-25", c2)
  context.addNamespace(ns21)
  context.addNamespace(ns22)
  context.addNamespace(ns23)
  context.addNamespace(ns24)
  context.addNamespace(ns25)

  const pod1101 = new Pod("abcdefgh-abcdefgh-abcdefgh-some-junk-pod-1101", ns11)
  const pod1102 = new Pod("abcdefgh-abcdefgh-some-junk-pod-1102", ns11)
  const pod1103 = new Pod("abcdefgh-some-junk-pod-1103", ns11)
  const pod1104 = new Pod("some-junk-pod-1104", ns11)
  const pod1105 = new Pod("some-junk-pod-1105", ns11)
  const pod1201 = new Pod("some-junk-pod-1201", ns12)
  const pod1202 = new Pod("some-junk-pod-1202", ns12)
  const pod1203 = new Pod("some-junk-pod-1203", ns12)
  const pod1301 = new Pod("some-junk-pod-1301", ns13)
  const pod1302 = new Pod("some-junk-pod-1302", ns13)
  const pod1401 = new Pod("some-junk-pod-1401", ns14)
  context.addPod(pod1101)
  context.addPod(pod1102)
  context.addPod(pod1103)
  context.addPod(pod1104)
  context.addPod(pod1105)
  context.addPod(pod1201)
  context.addPod(pod1202)
  context.addPod(pod1203)
  context.addPod(pod1301)
  context.addPod(pod1302)
  context.addPod(pod1401)

  const pod2101 = new Pod("abcdefgh-abcdefgh-some-junk-pod-2101", ns21)
  const pod2102 = new Pod("abcdefgh-some-junk-pod-2102", ns21)
  const pod2103 = new Pod("some-junk-pod-2103", ns21)
  const pod2104 = new Pod("some-junk-pod-2104", ns21)
  const pod2105 = new Pod("some-junk-pod-2105", ns21)
  const pod2201 = new Pod("some-junk-pod-2201", ns22)
  const pod2202 = new Pod("some-junk-pod-2202", ns22)
  const pod2203 = new Pod("some-junk-pod-2203", ns22)
  const pod2301 = new Pod("some-junk-pod-2301", ns23)
  const pod2302 = new Pod("some-junk-pod-2302", ns23)
  const pod2401 = new Pod("some-junk-pod-2401", ns24)
  context.addPod(pod2101)
  context.addPod(pod2102)
  context.addPod(pod2103)
  context.addPod(pod2104)
  context.addPod(pod2105)
  context.addPod(pod2201)
  context.addPod(pod2202)
  context.addPod(pod2203)
  context.addPod(pod2301)
  context.addPod(pod2302)
  context.addPod(pod2401)

  return context
}
