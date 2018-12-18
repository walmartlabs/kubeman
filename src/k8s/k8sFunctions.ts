import jsonUtil from '../util/jsonUtil'
import {K8sClient} from './k8sClient'
import {Cluster, Namespace, Pod} from "./k8sObjectTypes";

export type DataObject = {[key: string]: any}
export type StringStringStringBooleanMap = {[key: string]: {[key: string]: {[key: string]: boolean}}}
export type StringStringArrayMap = {[key: string]: {[key: string]: any[]}}
export type ComparisonFunction = (cluster: string, namespace: string, k8sClient: K8sClient) => any

export default class K8sFunctions {

  static extractMetadata(data : any) : DataObject|DataObject[] {
    const prettifyLabels = (meta: DataObject) => {
      if(meta.labels) {
        meta.labels = jsonUtil.convertObjectToArray(meta.labels)
      }
    }
    const metaFields = ["name", "creationTimestamp", "labels"]
    if(data instanceof Array) {
      const metas : DataObject[] = jsonUtil.extractMulti(data, "$[*].metadata", ...metaFields)
      metas.forEach(prettifyLabels)
      return metas
    } else {
      const meta : DataObject = jsonUtil.extract(data, "$.metadata", ...metaFields)
      prettifyLabels(meta)
      return meta
    }
  }

  static async getClusterNodes(cluster: string, k8sClient: K8sClient) {
    const nodes : any[] = []
    const result = await k8sClient.nodes.get()
    if(result && result.body) {
      const items = result.body.items
      items.forEach(item => {
        const meta : DataObject = this.extractMetadata(item)
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
  
  static async getClusterNamespaces(cluster: string, k8sClient: K8sClient) {
    const namespaceList : any[] = []
    const result = await k8sClient.namespaces.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = this.extractMetadata(items)
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

  static async getNamespaceServiceNames(namespace: string, k8sClient: K8sClient) {
    const services : any[] = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = this.extractMetadata(items)
      meta.forEach((item, index) => {
        services.push(item.name)
      })
    }
    return services
  }

  static async getNamespaceServices(cluster: string, namespace: string, k8sClient: K8sClient) {
    const services : any[] = []
    const result = await k8sClient.namespaces(namespace).services.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = this.extractMetadata(items)
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

  static async getClusterServices(cluster: string, k8sClient: K8sClient) {
    const namespaces = await this.getClusterNamespaces(cluster, k8sClient)
    const services = {}
    for(const i in namespaces) {
      services[namespaces[i].name] = await this.getNamespaceServiceNames(namespaces[i].name, k8sClient)
    }
    return services
  }

  static async getServicesGroupedByClusterNamespace(clusters: Cluster[], 
                  k8sClients: K8sClient[], namespaces?: Namespace[]) {
    const services: StringStringArrayMap = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      services[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        services[cluster] = await this.getClusterServices(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            services[cluster][namespace] = await this.getNamespaceServiceNames(namespace, k8sClient)
          }
        }
      }
    }
    return services
  }

  static async getDeploymentListForNamespace(namespace: string, k8sClient: K8sClient) {
    const deployments : any[] = []
    const result = await k8sClient.apps.namespaces(namespace).deployments.get()
    if(result && result.body) {
      const items = result.body.items
      const meta = this.extractMetadata(items)
      meta.forEach((item, index) => {
        deployments.push(item.name)
      })
    }
    return deployments
  }

  static async getDeploymentListForCluster(cluster: string, k8sClient: K8sClient) {
    const namespaces = await this.getClusterNamespaces(cluster, k8sClient)
    const deployments = {}
    for(const i in namespaces) {
      deployments[namespaces[i].name] = await this.getDeploymentListForNamespace(namespaces[i].name, k8sClient)
    }
    return deployments
  }

  static async getDeploymentsGroupedByClusterNamespace(clusters: Cluster[], 
                  k8sClients: K8sClient[], namespaces?: Namespace[]) {
    const deployments: StringStringArrayMap = {}
    for(const i in clusters) {
      const cluster = clusters[i].name
      const k8sClient = k8sClients[i]
      deployments[cluster] = {}

      if(!namespaces || namespaces.length === 0) {
        deployments[cluster] = await this.getDeploymentListForCluster(cluster, k8sClient)
      } else {
        for(const j in namespaces) {
          if(namespaces[j].cluster.name === cluster) {
            const namespace = namespaces[j].name
            deployments[cluster][namespace] = await this.getDeploymentListForNamespace(namespace, k8sClient)
          }
        }
      }
    }
    return deployments
  }

  static async getNamespaceDeployments(cluster: string, namespace: string, k8sClient: K8sClient) {
    const deployments : any[] = []
    const result = await k8sClient.apps.namespaces(namespace).deployments.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = this.extractMetadata(items)
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
          template: this.extractPodDetails(spec.template),
        })
      })
    }
    return deployments
  }

  static async getNamespaceSecrets(cluster: string, namespace: string, k8sClient: K8sClient) {
    const secrets : any[] = []
    const result = await k8sClient.namespaces(namespace).secrets.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = this.extractMetadata(items)
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

  static async getNamespaceConfigMaps(cluster: string, namespace: string, k8sClient: K8sClient) {
    const configMaps : any[] = []
    const result = await k8sClient.namespaces(namespace).configmaps.get()
    if(result && result.body) {
      const items = result.body.items
      const metas = this.extractMetadata(items)
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

  static async getNamespacePods(namespace: string, podNames: string[], k8sClient: K8sClient) {
    const pods : any[] = []
    for(const p in podNames) {
      const podDetails = await k8sClient.namespace(namespace).pods(podNames[p]).get()
      podDetails && pods.push(podDetails.body)
    }
    return pods
  }

  static async getPodDetails(namespace: string, podName: string, k8sClient) {
    const result = await k8sClient.namespace(namespace).pods(podName).get()
    if(result && result.body) {
      return this.extractPodDetails(result)
    }
    return {}
  }

  static extractPodDetails(podTemplate) {
    const meta = this.extractMetadata(podTemplate)
    const initContainers = jsonUtil.extract(podTemplate, "$.spec.initContainers", 
                          "name", "image", "securityContext")
    const containers = jsonUtil.extractMulti(podTemplate, "$.spec.containers[*]", 
                          "name", "image", "imagePullPolicy", "ports", "resources", 
                          "volumeMounts", "securityContext")
    return {
      ...meta,
      containers: containers,
      initContainers: initContainers,
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
      volumes: podTemplate.spec.volumes,
    }
  }

  static async getPodsDetails(namespace: string, podNames: string[], k8sClient: K8sClient) {
    const pods : any[] = []
    for(const p in podNames) {
      let result = await k8sClient.namespace(namespace).pods(podNames[p]).get()
      if(result && result.body) {
        const pod = result.body

        const conditions = jsonUtil.extractMulti(pod, "$.status.conditions[*]",
                                "type", "status", "message")
                            .map(jsonUtil.convertObjectToString)
        const containerStatuses = jsonUtil.extractMulti(pod, "$.status.containerStatuses[*]", "name", "state")
                                    .map(jsonUtil.convertObjectToString)
        pods.push({
          ...this.extractPodDetails(pod),
          conditions,
          containerStatuses,
        })
      }
    }
    return pods
  }

  static processEventsData(result) {
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

  static async getClusterEvents(cluster: string, k8sClient: K8sClient) {
    return this.processEventsData(await k8sClient.events.get({qs: {limit: 20}}))
  }

  static async getNamespaceEvents(namespace: string, k8sClient: K8sClient) {
    return this.processEventsData(await k8sClient.namespaces(namespace).events.get({qs: {limit: 20}}))
  }

  static async getPodEvents(namespace: string, pod: string, k8sClient: K8sClient) {
    return this.processEventsData(await k8sClient.namespaces(namespace).events.get({
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
}
