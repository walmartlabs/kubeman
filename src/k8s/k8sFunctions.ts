import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import {Cluster, Namespace, Pod, Metadata, PodInfo, PodDetails, PodTemplate, PodStatus,
        ContainerInfo, ContainerStatus, PodContainerDetails, ServiceDetails} from "./k8sObjectTypes";

export type DataObject = {[key: string]: any}
export type StringStringStringBooleanMap = {[key: string]: {[key: string]: {[key: string]: boolean}}}
export type StringStringArrayMap = {[key: string]: {[key: string]: any[]}}
export type GetItemsFunction = (cluster: string, namespace: string|undefined, k8sClient: K8sClient) => Promise<any[]>

export default class K8sFunctions {

  static extractMetadata = (data : any) : Metadata|Metadata[] => {
    const prettifyLabels = (meta: DataObject) => {
      if(meta.labels) {
        meta.labels = jsonUtil.convertObjectToArray(meta.labels)
      } 
      if(meta.annotations) {
        delete meta.annotations["kubectl.kubernetes.io/last-applied-configuration"]
        meta.annotations = jsonUtil.convertObjectToArray(meta.annotations)
      }
    }
    const metaFields = ["name", "namespace", "creationTimestamp", "labels", "annotations"]
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
        const status = jsonUtil.extract(item, "$.status", "addresses", "conditions", "nodeInfo", "capacity")
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
            capacity: status.capacity
          }
        }
        status.addresses.forEach(a => node.network[a.type] = a.address)
        status.conditions.forEach(c => node.condition[c.type] = {status:c.status, message:c.message})
        nodes.push(node)
      })
    }
    return nodes
  }
  
  static getClusterCRDs = async (k8sClient: K8sClient) => {
    const crds : any[] = []
    const result = await k8sClient.extensions.customresourcedefinitions.get()
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
      selector: jsonUtil.convertObjectToArray(spec.selector),
      sessionAffinity: spec.sessionAffinity,
      sessionAffinityConfig: spec.sessionAffinityConfig,
      type: spec.type,
      loadBalancer: status.loadBalancer,
    } as ServiceDetails
  }

  static getServices: GetItemsFunction = async (cluster, namespace, k8sClient) => {
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

  static getServiceDetails = async (namespace: string, service: string, k8sClient: K8sClient) => {
    let services = await K8sFunctions.getServices("", namespace, k8sClient)
    services = services.filter(s => s.name.includes(service) || service.includes(s.name))
    return services.length > 0 ? services[0] : undefined
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
    for(const i in clusters) {
      const cluster = clusters[i]
      services[cluster.name] = {}

      if(!namespaces || namespaces.length === 0) {
        services[cluster.name] = await K8sFunctions.getClusterServiceNames(cluster.name, cluster.k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster.name) {
            const namespace = namespaces[j].name
            services[cluster.name][namespace] = await K8sFunctions.getNamespaceServiceNames(namespace, cluster.k8sClient)
          }
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
    for(const i in clusters) {
      const cluster = clusters[i]
      deployments[cluster.name] = {}

      if(!namespaces || namespaces.length === 0) {
        deployments[cluster.name] = await K8sFunctions.getDeploymentListForCluster(cluster.name, cluster.k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster.name) {
            const namespace = namespaces[j]
            deployments[cluster.name][namespace.name] = await K8sFunctions.getDeploymentListForNamespace(namespace.name, cluster.k8sClient)
          }
        }
      }
    }
    return deployments
  }

  static getNamespaceDeployments: GetItemsFunction = async (cluster, namespace, k8sClient) => {
    const deployments : any[] = []
    const result = namespace ? await k8sClient.apps.namespaces(namespace).deployments.get() : undefined
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
          status: statuses[index]
        })
      })
    }
    return deployments
  }

  static getDeploymentDetails = async (cluster: string, namespace: string, 
                                                      deployment: string, k8sClient: K8sClient) => {
    const result = await k8sClient.apps.namespaces(namespace).deployments(deployment).get()
    if(result && result.body) {
      const meta = K8sFunctions.extractMetadata(result.body) as Metadata
      const spec = result.body.spec
      const status = result.body.status
      return {
          ...meta,
          minReadySeconds: spec.minReadySeconds,
          paused: spec.paused,
          progressDeadlineSeconds: spec.progressDeadlineSeconds,
          replicas: spec.replicas,
          revisionHistoryLimit: spec.revisionHistoryLimit,
          selector: spec.selector,
          strategy: spec.strategy,
          template: K8sFunctions.extractPodTemplate(spec.template),
          status,
      }
    }
    return undefined
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
        }
        const firstDash = secret.name.indexOf('-') 
        const lastDash = secret.name.lastIndexOf('-')
        if(firstDash > 0 && lastDash > 0 && firstDash !== lastDash) {
          secret.name = secret.name.slice(0, lastDash)
        }
        secrets.push(secret)
      })
    }
    return secrets
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

  static getPodsByLabels = async (namespace: string, labels: string, k8sClient: K8sClient) => {
    const result = await k8sClient.namespace(namespace).pods.get({qs: {labelSelector: labels}})
    const pods : PodDetails[] = []
    if(result && result.body) {
      result.body.items.forEach(item => pods.push(K8sFunctions.extractPodDetails(item)))
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
    const result = await k8sClient.namespace(namespace).pods.get()
    if(result && result.body) {
      result.body.items.forEach(item => pods.push(K8sFunctions.extractPodDetails(item)))
    }
    return pods
  }

  static async getPodsAndContainersForService(namespace: string, service: ServiceDetails, 
                                            k8sClient: K8sClient, loadDetails: boolean = false) {
    if(!service || !service.selector || service.selector.length === 0) {
      return {}
    }
    const servicePods = await K8sFunctions.getPodsByLabels(namespace, 
                            service.selector.map(selector => selector.replace(": ","="))
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

  static getPodLog = async (namespace: string, pod: string, container: string, 
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
