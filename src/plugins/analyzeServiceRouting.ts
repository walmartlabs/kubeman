/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
//import x509 from 'x509'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder} from '../actions/actionSpec'
import K8sFunctions from '../k8s/k8sFunctions'
import IstioFunctions from '../k8s/istioFunctions'
import ChoiceManager, {ItemSelection} from '../actions/choiceManager'
import { ContainerInfo, PodDetails, ServiceDetails, Cluster } from '../k8s/k8sObjectTypes';
import { K8sClient } from '../k8s/k8sClient';
import {outputIngressVirtualServicesAndGatewaysForService} from './analyzeIstioIngress'

const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Analysis Recipes",
  order: ActionContextOrder.Analysis,
  actions: [
    {
      name: "Analyze Service Details and Routing",
      order: 1,
      loadingMessage: "Loading Services...",

      choose: ChoiceManager.chooseService.bind(ChoiceManager, 1, 1),

      async act(actionContext) {
        const selections: ItemSelection[] = await ChoiceManager.getServiceSelections(actionContext)
        if(selections.length < 1) {
          this.onOutput && this.onOutput([["No service selected"]], ActionOutputStyle.Text)
          return
        }
        this.showOutputLoading && this.showOutputLoading(true)
        const service = selections[0].item
        const namespace = selections[0].namespace
        const cluster = actionContext.getClusters()
                            .filter(c => c.name === selections[0].cluster)[0]
        this.onOutput && this.onOutput([["Service Analysis for: " + service.name 
                              + ", Namespace: " + namespace + ", Cluster: " + cluster.name]], ActionOutputStyle.Table)
        this.onStreamOutput && this.onStreamOutput([[">Service Details"], [service.yaml]])

        const podsAndContainers = await K8sFunctions.getPodsAndContainersForService(service, cluster.k8sClient, true)
        this.outputPodsAndContainers(podsAndContainers)
        if(cluster.hasIstio) {
          const serviceEntries = await this.outputServiceEntries(service, cluster.k8sClient)
          const sidecarConfigs = await this.outputSidecarConfigs(service, cluster.k8sClient)
          const vsGateways = await this.outputVirtualServicesAndGateways(service, cluster.k8sClient)
          const ingressPods = await IstioFunctions.getIngressGatewayPods(cluster.k8sClient, true)
          if(Object.keys(vsGateways.ingressCerts).length > 0) {
            await this.outputCertsStatus(vsGateways.ingressCerts, ingressPods, cluster.k8sClient)
          }
          await this.outputPolicies(service, cluster.k8sClient)
          await this.outputDestinationRules(service, cluster.k8sClient)
          this.showOutputLoading && this.showOutputLoading(true)
          await this.outputRoutingAnalysis(service, podsAndContainers, vsGateways, ingressPods, 
                                                  sidecarConfigs, cluster)
          this.showOutputLoading && this.showOutputLoading(true)
          await this.outputIngressGatewayConfigs(service, cluster.k8sClient)

        } else {
          this.onStreamOutput && this.onStreamOutput([[">>Istio not installed"]])
        }
        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      },
      async outputPodsAndContainers(podsAndContainers) {
        const containers = (podsAndContainers.containers as ContainerInfo[]) || []
        const isSidecarPresent = containers.filter(c => c.name === "istio-proxy").length === 1
        this.onStreamOutput && this.onStreamOutput([[">Envoy Sidecar Status"],
                                [isSidecarPresent ? "Sidecar Proxy Present" : "Sidecar Proxy Not Deployed"]]) 
        this.onStreamOutput && this.onStreamOutput([[">Service Containers"]])
        if(containers.length > 0) {
          containers.map(c => this.onStreamOutput && this.onStreamOutput([[">>"+c.name],[c]]))
        } else {
          this.onStreamOutput && this.onStreamOutput([["No containers"]])
        }

        const pods = podsAndContainers.pods as PodDetails[]
        this.onStreamOutput && this.onStreamOutput([[">Service Pods"]]) 
        if(pods && pods.length > 0) {
          pods.forEach(pod => this.onStreamOutput && this.onStreamOutput([
            [">>"+pod.name],
            [{
              creationTimestamp: pod.creationTimestamp,
              labels: pod.labels,
              annotations: pod.annotations,
              nodeName: pod.nodeName,
              podIP: pod.podIP,
              hostIP: pod.hostIP,
              phase: pod.phase,
              startTime: pod.startTime,
              conditions: pod.conditions,
              containerStatuses: pod.containerStatuses,
              initContainerStatuses: pod.initContainerStatuses,
            }]
          ]))
        } else {
          this.onStreamOutput && this.onStreamOutput([["No pods"]])
        }
        return podsAndContainers
      },

      async outputVirtualServicesAndGateways(service: ServiceDetails, k8sClient: K8sClient) {
        const output: ActionOutput = []
        const result = await outputIngressVirtualServicesAndGatewaysForService(service.name, service.namespace, k8sClient, output, true)
        this.onStreamOutput && this.onStreamOutput(output) 
        return result
      },

      async outputDNSCheck(service: ServiceDetails, cluster: Cluster, output: ActionOutput) {
        let clientPodForDNSLookup, container
        if(cluster.hasIstio) {
          clientPodForDNSLookup = await IstioFunctions.getAnyIngressGatewayPod(cluster.k8sClient)
          container = "istio-proxy"
        } else {
          clientPodForDNSLookup = await K8sFunctions.getAnyKubeAPIServerPod(cluster.k8sClient)
          container = "kube-apiserver"
        }
        const shortFqdn = service.name+"."+service.namespace
        const fullFqdn = shortFqdn+".svc.cluster.local"

        let result = await K8sFunctions.lookupDNSForFqdn(shortFqdn, clientPodForDNSLookup.namespace,
                              clientPodForDNSLookup.name, container, cluster.k8sClient)
        let ipMatched = result && result === service.clusterIP
        let succeeded = result && ipMatched
        let message = (succeeded ? "" : "[CONFLICT] ") + "DNS Check for Short Fqdn: " + shortFqdn + 
                                (succeeded ? " succeeded, IP: "+result : " failed. ")
        result && !ipMatched && (message += "Expected Service IP ["+service.clusterIP+"] but received ["+result+"]")
        output.push([message])

        result = await K8sFunctions.lookupDNSForFqdn(fullFqdn, clientPodForDNSLookup.namespace,
                              clientPodForDNSLookup.name, container, cluster.k8sClient)
        output.push([(result ? "" : "[CONFLICT] ") + "DNS Check for Full Fqdn: " + fullFqdn + (result ? " succeeded, IP: "+result : " failed")])
      },

      async outputRoutingAnalysis(service: ServiceDetails, podsAndContainers: any, vsGateways: any, ingressPods: any[], 
                                  sidecarConfigs, cluster: Cluster, asSubgroups: boolean = false) {
        const output: ActionOutput = []
        output.push([(asSubgroups ? ">>" : ">") + "Routing Analysis"])

        await this.outputDNSCheck(service, cluster, output)

        const hasPods = podsAndContainers.pods && podsAndContainers.pods.length > 0
        if(!hasPods) {
          output.push(["No pods found for the service."])
        } else {
          const containerPorts = podsAndContainers.containers ? 
                  _.flatten((podsAndContainers.containers as ContainerInfo[])
                      .map(c => c.ports ? _.flatten(c.ports.map(p => [p.containerPort, p.name])) : [])) : []

          const serviceTargetPorts = service.ports.map(p => p.targetPort)
          const invalidServiceTargetPorts = serviceTargetPorts.filter(p => !containerPorts.includes(p))
          output.push([
            invalidServiceTargetPorts.length > 0 ?
              "[CONFLICT] Found service target ports that are mismatched and don't exist as container ports: " + invalidServiceTargetPorts.join(", ")
              : "Service target ports correctly match container ports."
          ])
        }
        if(vsGateways.virtualServices.length > 0) {
          const servicePorts = service.ports.map(p => p.port)
          const vsDestinationPorts = 
            _.flatten(
              _.flatten(vsGateways.virtualServices.filter(vs => vs.http).map(vs => vs.http)
                        .concat(vsGateways.virtualServices.filter(vs => vs.tls).map(vs => vs.tls))
                        .concat(vsGateways.virtualServices.filter(vs => vs.tcp).map(vs => vs.tcp)))
              .filter(routeDetails => routeDetails.route)
              .map(routeDetails => routeDetails.route)
            )
            .filter(route => route.destination && route.destination.port)
            .map(route => route.destination.port.number)
          const invalidVSDestPorts = vsDestinationPorts.filter(p => !servicePorts.includes(p))
          output.push([
            invalidVSDestPorts.length > 0 ?
              "Found VirtualService destination ports that are mismatched and don't exist as service ports: " + invalidVSDestPorts.join(", ")
              : "VirtualService destination ports correctly match service ports."
          ])
        }

        const listeners = await IstioFunctions.getIngressGatewayEnvoyListeners(cluster.k8sClient)
        const ingressPorts: number[] = []
        listeners.forEach(l => ingressPorts.push(l.listener.address.socket_address.port_value))
        vsGateways.gateways && vsGateways.gateways.forEach(g => 
          g.matchingPorts && g.matchingPorts.forEach(port => {
            const found = ingressPorts.includes(port)
            output.push([
              "Ingress Gateway is " + (found ? "" : "not ")
              + "listening for gateway port " + port + " for gateway " + g.name
            ])
        }))

        if(hasPods) {
          if(cluster.canPodExec) {
            if(ingressPods && ingressPods.length > 0 ) {
              try {
                const servicePods = podsAndContainers.pods as PodDetails[]
                for(const pod of servicePods) {
                  if(pod.podIP) {
                    const result = await K8sFunctions.podExec("istio-system", ingressPods[0].name, 
                    "istio-proxy", cluster.k8sClient, ["ping", "-c 2", pod.podIP])
                    const pingSuccess = result.includes("2 received")
                    output.push([
                      "Pod " + pod.name + (pingSuccess ? " is Reachable" : ": is Unreachable") + " from ingress gateway"
                    ])
                  }
                }
              } catch(error) {}
            }
            else {
              output.push(["Cannot verify pod reachability as no Ingress Gateway pods available"])
            }
          } else {
            output.push(["Cannot verify pod reachability due to lack of pod command execution privileges"])
          }
        }
        const egressHosts = _.uniqBy(_.flatten(_.flatten(sidecarConfigs.egressSidecarConfigs.map(s => s.egress))
                                      .filter(e => e.hosts).map(e => e.hosts)))
        if(egressHosts.length > 0) {
          output.push(["Service can only reach out to the following namespace/service destinations: " + egressHosts.join(", ")])
        }

        const shortFqdn = "/"+service.name+"."+service.namespace
        const fullFqdn = "/"+shortFqdn+".svc.cluster.local"
        const sidecarsWithInvalidIncomingHosts = {}
        sidecarConfigs.incomingSidecarConfigs.forEach(s => {
          s.egress && s.egress.forEach(e => {
            e.hosts && e.hosts.forEach(h => {
              if(h.endsWith(shortFqdn) && ! h.endsWith(fullFqdn)) {
                sidecarsWithInvalidIncomingHosts[s.name+"."+s.namespace] = h
              }
            })
          })
        })
        const invalidSidecarNames = Object.keys(sidecarsWithInvalidIncomingHosts)
        if(invalidSidecarNames.length > 0) {
          output.push(["Following sidecars have invalid Egress Hosts config (must use full FQDN): " + invalidSidecarNames.join(", ")])
        }

        this.onStreamOutput && this.onStreamOutput(output)
      },

      async outputCertsStatus(ingressCerts: any, ingressPods: any[], k8sClient: K8sClient) {
        const output: ActionOutput = []
        output.push([">Service Ingress Certs"], [ingressCerts])

        output.push([">Service Ingress Certs Deployment Status"])
        const certPaths: string[] = []
        Object.keys(ingressCerts).forEach(key => {
          const cert = (ingressCerts[key] || "").trim()
          if(cert.length > 0) {
            certPaths.push(key)
            certPaths.push(cert)
          } else {
            output.push([key + ": Loaded via SDS"])
          }
        })
        if(certPaths.length > 0) {
          if(k8sClient.canPodExec) {
            for(const pod of ingressPods) {
              output.push([">>Pod: " + pod.name])
              try {
                const certsLoadedOnIngress = _.flatten((await IstioFunctions.getIngressCertsFromPod(pod.name, k8sClient))
                                              .filter(c => c.cert_chain)
                                              .map(c => c.cert_chain)
                                              .map(certChain => certChain instanceof Array ? certChain : [certChain]))

                for(const path of certPaths) {
                  const result = (await K8sFunctions.podExec("istio-system", pod.name, "istio-proxy", k8sClient, ["ls", path])).trim()
                  const isPathFound = path === result
                  const certLoadedInfo = certsLoadedOnIngress.filter(info => (info.path || info).includes(path))[0]
                  const isPrivateKey = path.indexOf(".key") > 0
                  output.push([path + (isPathFound ? " is present " : " is NOT present ") + "on the pod filesystem"])
                  if(!isPrivateKey) {
                    output.push([path + (certLoadedInfo ? " is loaded on pod >> " +JSON.stringify(certLoadedInfo) : " is NOT loaded on ingress gateway pod")])
                  }
                }
              } catch(error) {
                output.push(["Failed to check cert status due to error: " + error.message])
              }
            }
          } else {
            output.push(["Cannot check cert status due to lack of pod command execution privileges"])
          }
        }
        this.onStreamOutput && this.onStreamOutput(output)
      },

      async outputPolicies(service: ServiceDetails, k8sClient: K8sClient) {
        const policies = await IstioFunctions.getServicePolicies(service, k8sClient)
        const output: ActionOutput = []
        output.push([">Policies relevant to this service"])
        policies.length === 0 && output.push(["No Policies"])
        policies.forEach(p => output.push([">>"+p.name+"."+p.namespace],[p]))
        this.onStreamOutput && this.onStreamOutput(output)
        return policies
      },

      async outputDestinationRules(service: ServiceDetails, k8sClient: K8sClient) {
        const destinationRules = await IstioFunctions.getServiceDestinationRules(service, k8sClient)
        const output: ActionOutput = []
        output.push([">DestinationRules relevant to this service"])
        destinationRules.length === 0 && output.push(["No DestinationRules"])
        destinationRules.forEach(dr => output.push([">>"+dr.name+"."+dr.namespace],[dr]))
        this.onStreamOutput && this.onStreamOutput(output)
        return destinationRules
      },

      async outputServiceEntries(service: ServiceDetails, k8sClient: K8sClient) {
        const serviceEntries = await IstioFunctions.getServiceServiceEntries(service, k8sClient)
        const output: ActionOutput = []
        output.push([">ServiceEntries relevant to this service"])
        serviceEntries.length === 0 && output.push(["No ServiceEntries"])
        serviceEntries.forEach(se => output.push([">>"+se.name+"."+se.namespace],[se]))
        this.onStreamOutput && this.onStreamOutput(output)
        return serviceEntries
      },

      async outputSidecarConfigs(service: ServiceDetails, k8sClient: K8sClient) {
        const egressSidecarConfigs = await IstioFunctions.getServiceEgressSidecarConfigs(service, k8sClient)
        const incomingSidecarConfigs = await IstioFunctions.getServiceIncomingSidecarConfigs(service, k8sClient)
        const output: ActionOutput = []
        output.push([">Sidecar configs relevant to this service"])
        output.push([">>Egress Sidecar configs"])
        egressSidecarConfigs.length === 0 && output.push(["No Sidecar configs"])
        egressSidecarConfigs.forEach(sc => {
          delete sc.yaml
          output.push([">>>"+sc.name+"."+sc.namespace])
          output.push([sc])
        })
        output.push([">>Incoming Sidecar configs"])
        incomingSidecarConfigs.length === 0 && output.push(["No Sidecar configs"])
        incomingSidecarConfigs.forEach(sc => {
          delete sc.yaml
          output.push([">>>"+sc.name+"."+sc.namespace])
          output.push([sc])
        })
        this.onStreamOutput && this.onStreamOutput(output) 
        return {egressSidecarConfigs, incomingSidecarConfigs}
      },

      async outputIngressGatewayConfigs(service: ServiceDetails, k8sClient: K8sClient) {
        const configsByType = await IstioFunctions.getIngressEnvoyConfigsForService(service, k8sClient)
        const output: ActionOutput = []
        Object.keys(configsByType).forEach(configType => {
          output.push([">IngressGateway " + configType + " configs relevant to this service"])
          const configs = configsByType[configType]
          configs.length === 0 && output.push(["No " + configType + " configs"])
          configs.forEach(c => {
            output.push([">>"+c.title])
            output.push([c])
          })
        })
        this.onStreamOutput && this.onStreamOutput(output) 
      },
    },
  ],
}

export default plugin
