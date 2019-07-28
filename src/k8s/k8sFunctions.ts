/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import {Cluster, Namespace, Metadata, PodInfo, PodDetails, PodTemplate, PodStatus,
        ContainerInfo, ContainerStatus, PodContainerDetails, ServiceDetails} from "./k8sObjectTypes";
import KubectlClient from './kubectlClient';
import DateUtil from '../util/dateUtil'

export type StringStringStringBooleanMap = {[key: string]: {[key: string]: {[key: string]: boolean}}}
export type StringStringArrayMap = {[key: string]: {[key: string]: any[]}}
export type GetItemsFunction = (cluster: string, namespace: string|undefined, k8sClient: K8sClient) => Promise<any[]>

export default class K8sFunctions {

  static extractMetadata = (data : any) : Metadata|Metadata[] => {
    const prettifyLabels = meta => {
      if(meta.annotations) {
        delete meta.annotations["kubectl.kubernetes.io/last-applied-configuration"]
        meta.annotations = jsonUtil.convertObjectToArray(meta.annotations)
      }
    }
    const metaFields = ["name", "namespace", "creationTimestamp", "labels", "annotations", "generation", "resourceVersion"]
    if(data instanceof Array) {
      const metas : Metadata[] = jsonUtil.extractMulti(data, "$[*].metadata", ...metaFields)
      metas.forEach(prettifyLabels)
      return metas
    } else {
      const meta : Metadata = jsonUtil.extract(data, "$.metadata", ...metaFields)
      prettifyLabels(meta)
      return meta
    }
  }

  static extractNodeDetails = (item) => {
    const meta = K8sFunctions.extractMetadata(item) as Metadata
    const spec = jsonUtil.extract(item, "$.spec", "podCIDR", "taints", "unschedulable")
    const status = jsonUtil.extract(item, "$.status", "addresses", "conditions", "nodeInfo", "capacity")
    const node = {
      ...meta,
      taints: spec.taints,
      network: {
        podCIDR: spec.podCIDR,
      },
      condition: {},
      info: {
        osImage: status.nodeInfo.osImage,
        containerRuntimeVersion: status.nodeInfo.containerRuntimeVersion,
        kubeletVersion: status.nodeInfo.kubeletVersion,
        kubeProxyVersion: status.nodeInfo.kubeProxyVersion,
        capacity: status.capacity,
        unschedulable: spec.unschedulable
      }
    }
    const nodeAddressesByType = {}
    status.addresses.forEach(a => {
      nodeAddressesByType[a.type] = (nodeAddressesByType[a.type] || new Set)
      nodeAddressesByType[a.type].add(a.address)
    })
    Object.keys(nodeAddressesByType).forEach(type => node.network[type] = Array.from(nodeAddressesByType[type]))
    status.conditions.forEach(c => node.condition[c.type] = {status:c.status, message:c.message})
    return node
  }

  static getClusterNodes = async (cluster: string, k8sClient: K8sClient) => {
    const nodes : any[] = []
    const result = await k8sClient.nodes.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach(item => {
        const node = K8sFunctions.extractNodeDetails(item)
        const nodeProxy = k8sClient.nodes(node.name).proxy('')
        const connection = nodeProxy['backend'] || nodeProxy['http']
        let baseUrl = connection ? connection.requestOptions.baseUrl as string : ''
        const firstIndex = baseUrl.indexOf(":")
        const lastIndex = baseUrl.lastIndexOf(":")
        if(firstIndex !== lastIndex) {
          baseUrl = baseUrl.slice(0,baseUrl.lastIndexOf(":"))
        }
        node['baseUrl'] = baseUrl
        nodes.push(node)
      })
    }
    return nodes
  }

  static getNodeDetails = async(nodeName: string, k8sClient: K8sClient) => {
    const result = await k8sClient.nodes(nodeName).get()
    if(result && result.body) {
      return K8sFunctions.extractNodeDetails(result.body)
    }
    return undefined
  }
  
  static getClusterCRDs = async (k8sClient: K8sClient) => {
    const crds : any[] = []
    try {
      const result = await k8sClient.apiextensions.customresourcedefinitions.get()
      if(result && result.body) {
        const items = result.body.items
        items.forEach(item => {
          crds.push({
            ...K8sFunctions.extractMetadata(item),
            spec: item.spec,
            conditions: item.status.conditions,
            storedVersions: item.status.storedVersions
          })
        })
      }
    } catch(error) {
      console.log(error)
    }
    return crds
  }
  
  static getClusterNamespaces = async (k8sClient: K8sClient) => {
    const namespaceList : any[] = []
    const result = await k8sClient.namespaces.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = K8sFunctions.extractMetadata(items) as Metadata[]
      const status = jsonUtil.extractMulti(items, "$[*].status", "phase")
      meta.forEach((item, index) => {
        namespaceList.push({
          ...item,
          status: status[index].phase,
        })
      })
    }
    return namespaceList
  }

  static getNamespaceServiceNames = async (namespace: string, k8sClient: K8sClient) => {
    const services : string[] = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = K8sFunctions.extractMetadata(items) as Metadata[]
      meta.forEach((item, index) => {
        services.push(item.name)
      })
    }
    return services
  }

  private static extractServiceDetails(service: any) : ServiceDetails {
    const meta = K8sFunctions.extractMetadata(service)
    const spec = service.spec
    const status = service.status
    return {
      ...meta,
      clusterIP: spec.clusterIP,
      externalIPs: spec.externalIPs,
      externalName: spec.externalName,
      externalTrafficPolicy: spec.externalTrafficPolicy,
      healthCheckNodePort: spec.healthCheckNodePort,
      loadBalancerIP: spec.loadBalancerIP,
      loadBalancerSourceRanges: spec.loadBalancerSourceRanges,
      ports: spec.ports,
      publishNotReadyAddresses: spec.publishNotReadyAddresses,
      selector: spec.selector,
      sessionAffinity: spec.sessionAffinity,
      sessionAffinityConfig: spec.sessionAffinityConfig,
      type: spec.type,
      loadBalancer: status.loadBalancer,
      yaml: service,
    } as ServiceDetails
  }

  static getServicesWithDetails = async (namespace, k8sClient) => {
    const services : ServiceDetails[] = []
    let result = (namespace && namespace.length > 0) ? 
                await k8sClient.namespaces(namespace).services.get()
                : await k8sClient.services.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach((item, index) => {
        services.push(K8sFunctions.extractServiceDetails(item))
      })
    }
    return services
  }

  static getServices = async (namespace, k8sClient) => {
    if(k8sClient.cluster.hasKubectl) {
      return KubectlClient.getServices(k8sClient.cluster, namespace)
    } else {
      return K8sFunctions.getServicesWithDetails(namespace, k8sClient)
    }
  }

  static getClusterServices = async (k8sClient) => {
    return K8sFunctions.getServices('', k8sClient)
  }

  static getClusterExternalServices = async (k8sClient) => {
    return (await K8sFunctions.getServicesWithDetails('', k8sClient)).filter(s => s.type === "ExternalName")
  }

  static getServiceDetails = async (service: string, namespace: string, k8sClient: K8sClient) => {
    let services = await K8sFunctions.getServicesWithDetails(namespace, k8sClient)
    services = services.filter(s => s.name.includes(service) || service.includes(s.name))
    return services.length > 0 ? services[0] : undefined
  }

  static async getNamespaceEndpoints(namespace: string, k8sClient: K8sClient) {
    return k8sClient.namespaces(namespace).endpoints.get()
  }

  static async getServiceEndpoints(service: string, namespace: string, k8sClient: K8sClient) {
    const result = await k8sClient.namespaces(namespace).endpoints(service).get()
    if(result && result.body) {
      return result.body.subsets as any[]
    }
    return []
  }

  static getClusterServiceNames = async (cluster: string, k8sClient: K8sClient) => {
    const namespaces = await K8sFunctions.getClusterNamespaces(k8sClient)
    const services : {[name: string] : string[]} = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await K8sFunctions.getNamespaceServiceNames(namespaces[i].name, k8sClient)
    }
    return services
  }

  static getServicesGroupedByClusterNamespace = async (clusters: Cluster[], namespaces?: Namespace[]) => {
    const services: StringStringArrayMap = {}
    for(const cluster of clusters) {
      services[cluster.name] = {}

      if(!namespaces || namespaces.length === 0) {
        services[cluster.name] = await K8sFunctions.getClusterServiceNames(cluster.name, cluster.k8sClient)
      } else {
        for(const namespace of namespaces) {
          services[cluster.name][namespace.name] = await K8sFunctions.getNamespaceServiceNames(namespace.name, cluster.k8sClient)
        }
      }
    }
    return services
  }

  static getServicesByLabels = async (namespace: string, labels: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespace(namespace).services.get({qs: {labelSelector: labels}})
    const services : ServiceDetails[] = []
    if(result && result.body) {
      result.body.items.forEach(item => services.push(K8sFunctions.extractServiceDetails(item)))
    }
    return services
  }

  static getServicesByPorts = async (ports: number[], k8sClient: K8sClient) => {
    const services = await K8sFunctions.getServicesWithDetails('', k8sClient)
    return services.filter(s => s.ports && s.ports.filter(p => 
      ports.includes(p.port) || p.targetPort && ports.includes(p.targetPort)
    ).length > 0)
  }
  
  static getDeploymentListForNamespace = async (namespace: string, k8sClient: K8sClient) => {
    const deployments : any[] = []
    const result = await k8sClient.apps.namespaces(namespace).deployments.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = K8sFunctions.extractMetadata(items) as Metadata[]
      meta.forEach((item, index) => {
        deployments.push(item.name)
      })
    }
    return deployments
  }

  static getDeploymentListForCluster = async (cluster: string, k8sClient: K8sClient) => {
    const namespaces = await K8sFunctions.getClusterNamespaces(k8sClient)
    const deployments = {}
    for(const i in namespaces) {
      deployments[namespaces[i].name] = await K8sFunctions.getDeploymentListForNamespace(namespaces[i].name, k8sClient)
    }
    return deployments
  }

  static getDeploymentsGroupedByClusterNamespace = async (clusters: Cluster[], namespaces?: Namespace[]) => {
    const deployments: StringStringArrayMap = {}
    for(const cluster of clusters) {
      deployments[cluster.name] = {}

      if(!namespaces || namespaces.length === 0) {
        deployments[cluster.name] = await K8sFunctions.getDeploymentListForCluster(cluster.name, cluster.k8sClient)
      } else {
        for(const namespace of namespaces) {
          deployments[cluster.name][namespace.name] = await K8sFunctions.getDeploymentListForNamespace(namespace.name, cluster.k8sClient)
        }
      }
    }
    return deployments
  }

  static extractDeploymentDetails(data: any) {
    const meta = K8sFunctions.extractMetadata(data) as Metadata
    const spec = data.spec
    const status = data.status
    return {
        ...meta,
        minReadySeconds: spec.minReadySeconds,
        paused: spec.paused,
        progressDeadlineSeconds: spec.progressDeadlineSeconds,
        replicas: spec.replicas,
        revisionHistoryLimit: spec.revisionHistoryLimit,
        selector: spec.selector,
        strategy: spec.strategy,
        template: K8sFunctions.extractPodTemplate(spec.template, false),
        status,
        yaml: data,
    }
  }

  static getNamespaceDeployments: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    const deployments : any[] = []
    if(!namespace) return deployments
    const result = await k8sClient.apps.namespaces(namespace).deployments.get()
    if(result && result.body) {
      result.body.items.forEach(item => deployments.push(K8sFunctions.extractDeploymentDetails(item)))
    }
    return deployments
  }

  static getDeploymentDetails = async (cluster: string, namespace: string, 
                                                      deployment: string, k8sClient: K8sClient) => {
    try {
      const result = await k8sClient.apps.namespaces(namespace).deployments(deployment).get()
      if(result && result.body) {
        return K8sFunctions.extractDeploymentDetails(result.body)
      }
    } catch(error) {}
    return undefined
  }


  static getNamespaceStatefulSets: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    const statefulSets : any[] = []
    if(!namespace) return statefulSets
    const result = await k8sClient.apps.namespaces(namespace).statefulsets.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items) as Metadata[]
      for(const i in items) {
        statefulSets.push({
          ...metas[i],
          yaml: items[i]
        })
      }
    }
    return statefulSets
  }

  static getNamespaceSecrets: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    const secrets : any[] = []
    const result = namespace ? await k8sClient.namespaces(namespace).secrets.get() : undefined
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items)
      items.forEach((item, index) => {
        const secret = {
          ...metas[index],
          type: item.type,
          kind: item.kind,
          stringData: item.stringData,
          data: item.data
        }
        secrets.push(secret)
      })
    }
    return secrets
  }

  static getNamespaceSecret = async (secret: string, namespace: string, k8sClient) => {
    const result = namespace ? await k8sClient.namespaces(namespace).secrets(secret).get() : undefined
    if(result && result.body) {
      const meta = K8sFunctions.extractMetadata(result.body) as Metadata
      return {
        ...meta,
        type: result.body.type,
        kind: result.body.kind,
        stringData: result.body.stringData,
        data: result.body.data
      }
    }
    return undefined
  }

  static getNamespaceConfigMaps: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    const configMaps : any[] = []
    const result = namespace ? await k8sClient.namespaces(namespace).configmaps.get() : undefined
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items) as Metadata[]
      items.forEach((item, index) => {
        configMaps.push({
          ...metas[index],
          kind: item.kind,
          data: item.data,
          yaml: item
        })
      })
    }
    return configMaps
  }

  static getNamespaceConfigMap = async (configMapName: string, namespace: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespaces(namespace).configmaps(configMapName).get()
    if(result && result.body) {
      const item = result.body
      return {
        ...K8sFunctions.extractMetadata(item),
        data: item.data
      }
    }
    return undefined
  }
  
  static getPodDetails = async (namespace: string, pod: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespace(namespace).pods(pod).get()
    if(result && result.body) {
      return K8sFunctions.extractPodDetails(result.body)
    }
    return undefined
  }

  static getPodsListByLabels = async (namespace: string, labels: string, k8sClient: K8sClient) => {
    let pods: any
    if(k8sClient.cluster.hasKubectl) {
      pods = KubectlClient.getPodsByLabels(k8sClient.cluster, namespace, labels)
    } else {
      const result = await k8sClient.namespace(namespace).pods.get({qs: {
        labelSelector: labels,
        fieldSelector: { status: { phase: "Running" } },
      }})
      if(result && result.body) {
        pods = result.body.items.map(item => K8sFunctions.extractPodDetails(item))
          .filter(pod => pod.phase && pod.phase === 'Running')
          .map(pod => {
            return {
              cluster: k8sClient.cluster.context, 
              namespace, 
              name: pod.name, 
              podIP: pod.podIP, 
              hostIP: pod.hostIP, 
              nodeName: pod.nodeName
            }
          })
      }
    }
    return pods
  }

  static getPodsByLabels = async (namespace: string, labels: string, k8sClient: K8sClient) => {
    let result = await k8sClient.namespace(namespace).pods.get({qs: {
      labelSelector: labels,
      fieldSelector: { status: { phase: "Running" } },
    }})
    const pods : PodDetails[] = []
    if(result && result.body) {
      result.body.items.forEach(item => {
        const pod = K8sFunctions.extractPodDetails(item)
        if(pod.phase && pod.phase === 'Running') {
          pods.push(pod)
        }
      })
    }
    return pods
  }
  
  static getContainerDetails = async (namespace: string, podName: string, containerName: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespace(namespace).pods(podName).get()
    if(result && result.body) {
      const podTemplate =  K8sFunctions.extractPodTemplate(result.body)
      if(podTemplate.containers) {
        const containers = podTemplate.containers.filter(c => c.name === containerName)
        if(containers.length > 0) {
          const podStatus = K8sFunctions.extractPodStatus(result.body)
          const containerStatus = podStatus.containerStatuses && 
            podStatus.containerStatuses.filter(cs => cs.name === containerName)[0]
          const containerDetails: PodContainerDetails = {
            podInfo: K8sFunctions.extractPodInfo(result.body),
            containerInfo: containers[0],
            podStatus,
            containerStatus
          }
          return containerDetails
        }
      }
    }
    return undefined
  }

  static getNamespacePods = async (namespace: string, podNames: string[], k8sClient: K8sClient) => {
    const pods : PodDetails[] = []
    for(const p in podNames) {
      let result = await k8sClient.namespace(namespace).pods(podNames[p]).get()
      if(result && result.body) {
        pods.push(K8sFunctions.extractPodDetails(result.body))
      }
    }
    return pods
  }

  static getAllPodsForNamespace = async(namespace: string, k8sClient: K8sClient) => {
    const pods : any[] = []
    const result = await k8sClient.namespace(namespace).pods.get({qs: { 
      fieldSelector: { status: { phase: "Running" } },
      includeUninitialized: false
    }})
    if(result && result.body) {
      result.body.items.forEach(item => {
        const pod = K8sFunctions.extractPodDetails(item)
        if(pod.phase && pod.phase === 'Running') {
          pods.push(pod)
        }
      })
    }
    return pods
  }

  static getAllClusterPods = async(k8sClient: K8sClient) => {
    const pods : any[] = []
    const result = await k8sClient.pods.get({qs: { 
      fieldSelector: { status: { phase: "Running" } },
      includeUninitialized: false
    }})
    if(result && result.body) {
      result.body.items.forEach(item => {
        const pod = K8sFunctions.extractPodDetails(item)
        if(pod.phase && pod.phase === 'Running') {
          pods.push(pod)
        }
      })
    }
    return pods
  }

  static async getPodsAndContainersForServiceName(serviceName: string, serviceNamespace: string, k8sClient: K8sClient, loadDetails: boolean = false) {
    return K8sFunctions.getPodsAndContainersForService(
      await K8sFunctions.getServiceDetails(serviceName, serviceNamespace, k8sClient), k8sClient, loadDetails)
  }

  static async getPodsAndContainersForService(service: ServiceDetails|undefined, k8sClient: K8sClient, loadDetails: boolean = false) {
    if(!service || !service.selector) {
      return {}
    }
    const servicePods = await K8sFunctions.getPodsByLabels(service.namespace, 
              Object.keys(service.selector).map(s => s+"="+(service.selector ? service.selector[s]:""))
                              .join(","), k8sClient)
    if(!servicePods || servicePods.length === 0) {
      return {}
    }
    const podContainers = servicePods[0].containers
    if(!podContainers || podContainers.length === 0) {
      return {}
    }
    const pods = loadDetails ? servicePods : servicePods.map(p => p.name)
    const containers = loadDetails ? podContainers : podContainers.map(c => c.name)
    return {pods, containers}
  }

  static extractPodDetails = (pod) : PodDetails => {
    return {
      ...K8sFunctions.extractPodTemplate(pod),
      ...K8sFunctions.extractPodStatus(pod)
    }
  }

  static extractPodTemplate = (podTemplate, loadYaml: boolean = true) : PodTemplate => {
    const initContainers: ContainerInfo[] = jsonUtil.extract(podTemplate, "$.spec.initContainers", 
                          "name", "image", "securityContext")
    const containers: ContainerInfo[] = jsonUtil.extractMulti(podTemplate, "$.spec.containers[*]")
    return {
      ...K8sFunctions.extractPodInfo(podTemplate),
      containers: containers,
      initContainers: initContainers,
      volumes: podTemplate.spec.volumes,
      yaml: loadYaml ? podTemplate : undefined
    }
  }

  static extractPodInfo = (podTemplate) : PodInfo => {
    const meta = K8sFunctions.extractMetadata(podTemplate) as Metadata
    return {
      ...meta,
      ...podTemplate.spec
    }
  }

  static extractPodStatus = (pod) : PodStatus => {
    const conditions = jsonUtil.extractMulti(pod, "$.status.conditions[*]", "type", "status", "message")
    let containerStatuses: ContainerStatus[] = jsonUtil.extractMulti(pod, "$.status.containerStatuses[*]", "name", "state", "message")
    containerStatuses = containerStatuses.map(cs => {
      cs.state.message = cs.message
      return cs
    })
    const initContainerStatuses: ContainerStatus[] = jsonUtil.extractMulti(pod, "$.status.initContainerStatuses[*]", "name", "state", "message")

    return {
      ...pod.status,
      conditions,
      containerStatuses,
      initContainerStatuses,
    }
  }

  static processEventsData = (result) => {
    const events : any[] = []
    if(result && result.body) {
      const items = result.body.items
      if(items && items.length > 0) {
        const eventsData = jsonUtil.extractMulti(items, "$[*]", "type", "source", "reason", "message", "count", "lastTimestamp")
        eventsData.forEach(event => {
          events.push({
            count: event.count,
            reason: event.reason,
            type: event.type, 
            source: event.source.component, 
            message: event.message,
            involvedObject: event.involvedObject,
            firstTimestamp: event.firstTimestamp,
            lastTimestamp: event.lastTimestamp,
          })
        })
      } else {
        events.push({
          reason: "No Events"
        })
      }
    }
    return events
  }

  static getClusterEvents = async (cluster: string, k8sClient: K8sClient) => {
    return K8sFunctions.processEventsData(await k8sClient.events.get({qs: {limit: 20}}))
  }

  static getNamespaceEvents = async (namespace: string, k8sClient: K8sClient) => {
    return K8sFunctions.processEventsData(await k8sClient.namespaces(namespace).events.get({qs: {limit: 20}}))
  }

  static getPodEvents = async (namespace: string, pod, k8sClient: K8sClient) => {
    return K8sFunctions.processEventsData(await k8sClient.namespaces(namespace).events.get({
      qs: {
        limit: 20,
        fieldSelector: {
          involvedObject: {
            name: pod
          }
        },
      }
    }))
  }

  static async getHPAStatus(k8sClient: K8sClient, namespace?: string) {
    const result = namespace ? await k8sClient.autoscaling.namespace(namespace).horizontalpodautoscaler.get() :
                              await k8sClient.autoscaling.horizontalpodautoscaler.get()
    if(result && result.body) {
      const hpaStatus: any[] = result.body.items.map(item => {
        const meta = this.extractMetadata(item) as Metadata
        return {
          name: meta.name+"."+meta.namespace,
          reference: item.spec.scaleTargetRef.kind + "/" + item.spec.scaleTargetRef.name,
          minReplicas: item.spec.minReplicas,
          maxReplicas: item.spec.maxReplicas,
          currentReplicas: item.status.currentReplicas,
          desiredReplicas: item.status.desiredReplicas,
          currentCPUUtilizationPercentage: item.status.currentCPUUtilizationPercentage,
          targetCPUUtilizationPercentage: item.spec.targetCPUUtilizationPercentage,
          lastScaleTime: item.status.lastScaleTime,
          age: DateUtil.getAge(meta.creationTimestamp)
        }
      })
      let replicasetStatus: any[] = []
      if(namespace) {
        const rsResult = await k8sClient.apps.namespace(namespace).replicasets.get()
        if(rsResult && rsResult.body) {
          replicasetStatus = rsResult.body.items.map(item => {
            const meta = this.extractMetadata(item) as Metadata
            return {
              name: meta.name+"."+meta.namespace,
              desiredReplicas: item.spec.replicas,
              currentReplicas: item.status.replicas,
              availableReplicas: item.status.availableReplicas,
              fullyLabeledReplicas: item.status.fullyLabeledReplicas,
              readyReplicas: item.status.readyReplicas,
              observedGeneration: item.status.observedGeneration,
              age: DateUtil.getAge(meta.creationTimestamp)
            }
          })
        }
      }
      return {hpaStatus, replicasetStatus}
    }
    return undefined
  }

  static getPodLogViaAPI = async (namespace: string, pod: string, container: string, 
                          k8sClient: K8sClient, tail: boolean, lines: number = 50) => {
    const stream = await k8sClient.namespaces(namespace).pods(pod).log.getStream({
      qs: {
        tailLines: lines,
        follow: tail,
        container,
      }
    })
    return {
      onLog: (callback: (string) => void) => {
        stream.on('data', chunk => {
          callback(chunk.toString())
        })
      },
      stop: () => {
        stream && stream.abort()
      }
    }
  }
  static getPodLog = async (namespace: string, pod: string, container: string, 
                      k8sClient: K8sClient, tail: boolean, lines: number = 50) => {
    if(k8sClient.cluster.hasKubectl) {
      const {logProcess, stdout, stderr} = KubectlClient.getPodLogs(k8sClient.cluster, namespace, pod, container, tail, lines)
      return {
        onLog: (callback: (string) => void) => {
          stdout.on('data', data => callback(data.toString()))
          stderr.on("data", data => callback(data.toString()))
        },
        stop: () => {
          logProcess.kill()
        }
      }
    } else {
      return K8sFunctions.getPodLogViaAPI(namespace, pod, container, k8sClient, tail, lines)
    }
  }

  static podExec = async (namespace: string, pod: string, container: string, k8sClient: K8sClient, 
                          command: string[]) : Promise<string> => {
    if(k8sClient.canPodExec) {
      if(k8sClient.cluster.hasKubectl) {
        return await KubectlClient.executePodCommand(k8sClient.cluster, namespace, pod, container, command.join(" "))
      } else {
        const result = await k8sClient.namespaces(namespace).pods(pod).exec.post({
          qs: {
            container,
            command,
            stdout: true,
            stderr: true,
          }
        })
        if(result && result.body) {
          return result.body
        } else {
          return ""
        }
      }
    } else {
      return "Lacking pod command execution privileges"
    }
  }

  static async getAnyKubeAPIServerPod(k8sClient: K8sClient) {
    return (await K8sFunctions.getPodsByLabels("kube-system", "component=kube-apiserver", k8sClient))[0]
  }

  static async lookupDNSForFqdn(fqdn: string, namespace: string, pod: string, container: string, k8sClient: K8sClient) {
    if(k8sClient.canPodExec) {
      let result = await K8sFunctions.podExec(namespace, pod, container, k8sClient, ["dig", fqdn])
      if(result.includes("status: NOERROR")) {
        result = result.split(";; ANSWER SECTION:")[1].split(";;")[0].split(fqdn)[1].split("IN")[1].split("A")[1].trim()
        return result.length > 0 ? result : undefined
      } 
    }
    return undefined
  }

  static async getPodConnections(namespace: string, pod: string, container: string, k8sClient: K8sClient) {
    const commandText = "netstat -an"
    const command = ["sh", "-c"]
    command.push(k8sClient.cluster.hasKubectl ? "'" + commandText + "'" : commandText)
    return K8sFunctions.podExec(namespace, pod, container, k8sClient, command)
  }


  static async getPodTCPConnectionsInfo(namespace: string, pod: string, container: string, k8sClient: K8sClient) {
    const output = await K8sFunctions.getPodConnections(namespace, pod, container, k8sClient)
    const lines = output.split("\n").filter((line, index) => line.length > 0)
    const tcpLines = lines.filter(line => line.includes("tcp"))
    const listenLines = tcpLines.filter(line => line.includes("LISTEN"))
    const listenCount = listenLines.length
    const establishedLines = tcpLines.filter(line => line.includes("ESTABLISHED"))
    const establishedCount = establishedLines.length
    const timeWaitLines = tcpLines.filter(line => line.includes("TIME_WAIT"))
    const timeWaitCount = timeWaitLines.length

    const listenAddresses = listenLines.map(line => line.split(" ").filter(field => field.length > 0)[3])

    const getRemoteConnectionInfo = (lines, obj) => {
      lines.map(line => line.split(" ").filter(field => field.length > 0)[4])
            .forEach(a => {
              const ipPort = a.split(":")
              obj[ipPort[0]] = obj[ipPort[0]] || []
              obj[ipPort[0]].push(ipPort[1])
            })
      Object.keys(obj).forEach(key => obj[key] = obj[key].sort().join(", "))
    }

    const remoteEstablished = {}
    getRemoteConnectionInfo(establishedLines, remoteEstablished)

    const remoteTimeWait = {}
    getRemoteConnectionInfo(timeWaitLines, remoteTimeWait)

    return {
      listenCount, establishedCount, timeWaitCount, 
      listenAddresses, remoteEstablished, remoteTimeWait
    }
  }
}
