import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import {Cluster, Namespace, Pod, Metadata, PodInfo, PodDetails, PodTemplate, PodStatus,
        ContainerInfo, ContainerStatus, PodContainerDetails} from "./k8sObjectTypes";

export type DataObject = {[key: string]: any}
export type StringStringStringBooleanMap = {[key: string]: {[key: string]: {[key: string]: boolean}}}
export type StringStringArrayMap = {[key: string]: {[key: string]: any[]}}
export type GetItemsFunction = (cluster: string, namespace: string, k8sClient: K8sClient) => Promise<any[]>

export default class K8sFunctions {

  static extractMetadata = (data : any) : Metadata|Metadata[] => {
    const prettifyLabels = (meta: DataObject) => {
      if(meta.labels) {
        meta.labels = jsonUtil.convertObjectToArray(meta.labels)
      }
    }
    const metaFields = ["name", "creationTimestamp", "labels"]
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

  static getClusterNodes = async (cluster: string, k8sClient: K8sClient) => {
    const nodes : any[] = []
    const result = await k8sClient.nodes.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach(item => {
        const meta = K8sFunctions.extractMetadata(item) as Metadata
        const spec = jsonUtil.extract(item, "$.spec", "podCIDR")
        const status = jsonUtil.extract(item, "$.status", "addresses", "conditions", "nodeInfo")
        const node = {
          ...meta,
          network: {
            ip: spec.podCIDR,
          },
          condition: {},
          info: {
            osImage: status.nodeInfo.osImage,
            containerRuntimeVersion: status.nodeInfo.containerRuntimeVersion,
            kubeletVersion: status.nodeInfo.kubeletVersion,
            kubeProxyVersion: status.nodeInfo.kubeProxyVersion,
          }
        }
        status.addresses.forEach(a => node.network[a.type] = a.address)
        status.conditions.forEach(c => node.condition[c.type] = {status:c.status, message:c.message})
        nodes.push(node)
      })
    }
    return nodes
  }
  
  static getClusterNamespaces = async (cluster: string, k8sClient: K8sClient) => {
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
    const services : any[] = []
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

  static getNamespaceServices: GetItemsFunction = async (cluster: string, namespace: string, k8sClient: K8sClient) => {
    const services : any[] = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items)
      const specs = jsonUtil.extract(items, "$[*].spec")
      const statuses = jsonUtil.extract(items, "$[*].status")
      specs.forEach((spec, index) => {
        services.push({
          ...metas[index],
          clusterIP: spec.clusterIP,
          externalIPs: spec.externalIPs,
          externalName: spec.externalName,
          externalTrafficPolicy: spec.externalTrafficPolicy,
          healthCheckNodePort: spec.healthCheckNodePort,
          loadBalancerIP: spec.loadBalancerIP,
          loadBalancerSourceRanges: spec.loadBalancerSourceRanges,
          ports: spec.ports,
          publishNotReadyAddresses: spec.publishNotReadyAddresses,
          selector: jsonUtil.convertObjectToArray(spec.selector),
          sessionAffinity: spec.sessionAffinity,
          sessionAffinityConfig: spec.sessionAffinityConfig,
          type: spec.type,
          loadBalancer: statuses.loadBalancer,
        })
      })
    }
    return services
  }

  static getClusterServices = async (cluster: string, k8sClient: K8sClient) => {
    const namespaces = await K8sFunctions.getClusterNamespaces(cluster, k8sClient)
    const services = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await K8sFunctions.getNamespaceServiceNames(namespaces[i].name, k8sClient)
    }
    return services
  }

  static getServicesGroupedByClusterNamespace = async (clusters: Cluster[], 
                  k8sClients: K8sClient[], namespaces?: Namespace[]) => {
    const services: StringStringArrayMap = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      services[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        services[cluster] = await K8sFunctions.getClusterServices(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            services[cluster][namespace] = await K8sFunctions.getNamespaceServiceNames(namespace, k8sClient)
          }
        }
      }
    }
    return services
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
    const namespaces = await K8sFunctions.getClusterNamespaces(cluster, k8sClient)
    const deployments = {}
    for(const i in namespaces) {
      deployments[namespaces[i].name] = await K8sFunctions.getDeploymentListForNamespace(namespaces[i].name, k8sClient)
    }
    return deployments
  }

  static getDeploymentsGroupedByClusterNamespace = async (clusters: Cluster[], 
                  k8sClients: K8sClient[], namespaces?: Namespace[]) => {
    const deployments: StringStringArrayMap = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      deployments[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        deployments[cluster] = await K8sFunctions.getDeploymentListForCluster(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            deployments[cluster][namespace] = await K8sFunctions.getDeploymentListForNamespace(namespace, k8sClient)
          }
        }
      }
    }
    return deployments
  }

  static getNamespaceDeployments: GetItemsFunction = async (cluster: string, namespace: string, k8sClient: K8sClient) => {
    const deployments : any[] = []
    const result = await k8sClient.apps.namespaces(namespace).deployments.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items) as Metadata[]
      const specs = jsonUtil.extract(items, "$[*].spec")
      const statuses = jsonUtil.extract(items, "$[*].status")
      specs.forEach((spec, index) => {
        deployments.push({
          ...metas[index],
          minReadySeconds: spec.minReadySeconds,
          paused: spec.paused,
          progressDeadlineSeconds: spec.progressDeadlineSeconds,
          replicas: spec.replicas,
          revisionHistoryLimit: spec.revisionHistoryLimit,
          selector: spec.selector,
          strategy: spec.strategy,
          template: K8sFunctions.extractPodTemplate(spec.template),
        })
      })
    }
    return deployments
  }

  static getNamespaceSecrets: GetItemsFunction = async (cluster: string, namespace: string, k8sClient: K8sClient) => {
    const secrets : any[] = []
    const result = await k8sClient.namespaces(namespace).secrets.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items)
      items.forEach((item, index) => {
        const secret = {
          ...metas[index],
          type: item.type,
          kind: item.kind,
          stringData: item.stringData,
        }
        secret.name = secret.name.slice(0, secret.name.lastIndexOf('-'))
        secrets.push(secret)
      })
    }
    return secrets
  }

  static getNamespaceConfigMaps: GetItemsFunction = async (cluster: string, namespace: string, k8sClient: K8sClient) => {
    const configMaps : any[] = []
    const result = await k8sClient.namespaces(namespace).configmaps.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = K8sFunctions.extractMetadata(items) as Metadata[]
      items.forEach((item, index) => {
        configMaps.push({
          ...metas[index],
          kind: item.kind,
          data: item.data,
        })
      })
    }
    return configMaps
  }
  
  static getPodDetails = async (namespace: string, pod: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespace(namespace).pods(pod).get()
    if(result && result.body) {
      return K8sFunctions.extractPodDetails(result.body)
    }
    return undefined
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
    const result = await k8sClient.namespace(namespace).pods.get()
    if(result && result.body) {
      result.body.items.forEach(item => pods.push(K8sFunctions.extractPodDetails(item)))
    }
    return pods
  }

  static extractPodDetails = (pod) : PodDetails => {
    return {
      ...K8sFunctions.extractPodTemplate(pod),
      ...K8sFunctions.extractPodStatus(pod)
    }
  }

  static extractPodTemplate = (podTemplate) : PodTemplate => {
    const initContainers: ContainerInfo[] = jsonUtil.extract(podTemplate, "$.spec.initContainers", 
                          "name", "image", "securityContext")
    const containers: ContainerInfo[] = jsonUtil.extractMulti(podTemplate, "$.spec.containers[*]", 
                          "name", "image", "imagePullPolicy", "ports", "resources", 
                          "volumeMounts", "securityContext")
    return {
      ...K8sFunctions.extractPodInfo(podTemplate),
      containers: containers,
      initContainers: initContainers,
      volumes: podTemplate.spec.volumes,
    }
  }

  static extractPodInfo = (podTemplate) : PodInfo => {
    const meta = K8sFunctions.extractMetadata(podTemplate) as Metadata
    return {
      ...meta,
      activeDeadlineSeconds: podTemplate.spec.activeDeadlineSeconds,
      affinity: podTemplate.spec.affinity,
      dnsConfig: podTemplate.spec.dnsConfig,
      dnsPolicy: podTemplate.spec.dnsPolicy,
      hostAliases: podTemplate.spec.hostAliases,
      hostIPC: podTemplate.spec.hostIPC,
      hostNetwork: podTemplate.spec.hostNetwork,
      hostPID: podTemplate.spec.hostPID,
      hostname: podTemplate.spec.hostname,
      nodeName: podTemplate.spec.nodeName,
      nodeSelector: podTemplate.spec.nodeSelector,
      priority: podTemplate.spec.priority,
      priorityClassName: podTemplate.spec.priorityClassName,
      readinessGates: podTemplate.spec.readinessGates,
      restartPolicy: podTemplate.spec.restartPolicy,
      runtimeClassName: podTemplate.spec.runtimeClassName,
      schedulerName: podTemplate.spec.schedulerName,
      securityContext: podTemplate.spec.securityContext,
      serviceAccount: podTemplate.spec.serviceAccount,
      serviceAccountName: podTemplate.spec.serviceAccountName,
      shareProcessNamespace: podTemplate.spec.shareProcessNamespace,
      subdomain: podTemplate.spec.subdomain,
      terminationGracePeriodSeconds: podTemplate.spec.terminationGracePeriodSeconds,
    }
  }

  static extractPodStatus = (pod) : PodStatus => {
    const conditions = jsonUtil.extractMulti(pod, "$.status.conditions[*]",
                            "type", "status", "message")
                        .map(jsonUtil.convertObjectToString)
    const containerStatuses: ContainerStatus[] = jsonUtil.extractMulti(pod, "$.status.containerStatuses[*]", "name", "state")
                                .map(jsonUtil.convertObjectToString)
    const initContainerStatuses: ContainerStatus[] = jsonUtil.extractMulti(pod, "$.status.initContainerStatuses[*]", "name", "state")
                                .map(jsonUtil.convertObjectToString)
    return {
      podIP: pod.status.podIP,
      hostIP: pod.status.hostIP,
      message: pod.status.message,
      reason: pod.status.reason,
      phase: pod.status.phase,
      qosClass: pod.status.qosClass,
      startTime: pod.status.startTime,
      conditions,
      containerStatuses,
      initContainerStatuses,
    }
  }

  static processEventsData = (result) => {
    const events : any[] = []
    if(result && result.body) {
      const items = result.body.items
      if(items.length > 0) {
        const eventsData = jsonUtil.extractMulti(items, "$[*]", "type", "source", "reason", "message", "count", "lastTimestamp")
        eventsData.forEach(event => {
          events.push({
            reason: event.reason,
            type: event.type, 
            source: event.source.component, 
            message: event.message,
            count: event.count,
            lastTimestamp: event.lastTimestamp,
          })
        })
      } else {
        events.push({
          reason: "No Events",
          type: "", 
          source: "", 
          message: "",
          count: "",
          lastTimestamp: "",
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

  static getPodLog = async (namespace: string, pod: string, container: string, k8sClient: K8sClient, tail: boolean) => {
    const stream = await k8sClient.namespaces(namespace).pods(pod).log.getStream({
      qs: {
        tailLines: 200,
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

  static podExec = async (namespace: string, pod: string, container: string, k8sClient: K8sClient, 
                          command: string[]) : Promise<string> => {
    let result = await k8sClient.namespaces(namespace).pods(pod).exec.post({
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
      return "No Results"
    }
    return result
  }

}
