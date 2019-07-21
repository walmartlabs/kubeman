/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {ActionGroupSpec, ActionContextType, ActionOutputStyle, ActionOutput, ActionContextOrder, ActionSpec} from '../actions/actionSpec'
import IstioPluginHelper from '../k8s/istioPluginHelper'
import EnvoyFunctions, {EnvoyConfigType} from '../k8s/envoyFunctions'
import JsonUtil from '../util/jsonUtil';
import K8sFunctions from '../k8s/k8sFunctions';
import ChoiceManager from '../actions/choiceManager';


function identifyEnvoyClusterDiffs(diffPairs: any[], versionMismatchedPairs: any[], otherDiffPairs: any[], 
                                  additionalOutput: string[], ignoreKeys?: string[], ignoreValues?: string[]) {
  diffPairs.forEach(pair => {
    let diffs: string[] = []
    JsonUtil.compareObjects(pair[0], pair[1], diffs, ignoreKeys, ignoreValues)
    if(pair[0]["version_info"] && pair[1]["version_info"] && diffs.includes("version_info")) {
      versionMismatchedPairs.push(pair)
      diffs = diffs.filter(d => d !== "version_info")
    }
    if(ignoreKeys) {
      diffs = diffs.filter(d => !ignoreKeys.includes(d))
    }
    if(diffs.length > 0) {
      otherDiffPairs.push(pair)
      pair.push(diffs)
    }
  })
}


function identifyEnvoyListenerDiff(diffPairs: any[], versionMismatchedPairs: any[], otherDiffPairs: any[], 
                                  additionalOutput: string[], ignoreKeys?: string[], ignoreValues?: string[]) {
  diffPairs.forEach(pair => {
    const diffs: string[] = []
    const listener1 = pair[0]
    const listener2 = pair[1]

    if(listener1.version_info && listener2.version_info && listener1.version_info !== listener2.version_info) {
      versionMismatchedPairs.push(pair)
    }

    let tempDiffs: string[] = []
    if(listener1.listener && listener2.listener) {
      const socketAddress1 = listener1.listener.address && (listener1.listener.address.socket_address || listener1.listener.address.socketAddress)
      const socketAddress2 = listener2.listener.address && (listener2.listener.address.socket_address || listener2.listener.address.socketAddress)
      JsonUtil.compareObjects(socketAddress1, socketAddress2, tempDiffs, ignoreKeys, ignoreValues)
      tempDiffs.forEach(d => diffs.push("socket_addresss: " + d))

      tempDiffs = []
      const listenerFilters1 = listener1.listener.listener_filters && listener1.listener.listener_filters.map(f => f.name)
                                || listener1.listener.listenerFilters && listener1.listener.listenerFilters.map(f => f.name)
      const listenerFilters2 = listener2.listener.listener_filters && listener2.listener.listener_filters.map(f => f.name)
                                || listener2.listener.listenerFilters && listener2.listener.listenerFilters.map(f => f.name)
      if(listenerFilters1 || listenerFilters2) {
        JsonUtil.compareFlatArrays(listenerFilters1, listenerFilters2, tempDiffs, ignoreValues)
        tempDiffs.forEach(d => diffs.push("listener_filters mismatch: " + d))
      }

      tempDiffs = []
      const filterChains1 = listener1.listener.filter_chains || listener1.listener.filterChains
      const filterChains2 = listener2.listener.filter_chains || listener2.listener.filterChains
      if(filterChains1 || filterChains2) {
        const serverNamesList1 = filterChains1 ? filterChains1.filter(fc => fc.filter_chain_match || fc.filterChainMatch)
                                      .map(fc => fc.filter_chain_match || fc.filterChainMatch)
                                      .map(fcm => fcm.server_names || fcm.serverNames)
                                      .map(s => s.sort()) : []
        const serverNamesList2 = filterChains2 ? filterChains2.filter(fc => fc.filter_chain_match || fc.filterChainMatch)
                                      .map(fc => fc.filter_chain_match || fc.filterChainMatch)
                                      .map(fcm => fcm.server_names || fcm.serverNames)
                                      .map(s => s.sort()) : []

        serverNamesList1.forEach((serverNames1, i) => {
          let found = false
          for(const serverNames2 of serverNamesList2) {
            if(JsonUtil.compareFlatArrays(serverNames1, serverNames2)) {
              found = true
              break
            }
          }
          if(!found) {
            diffs.push("{<--} filter_chains["+i+"] - server_names mismatch")
            additionalOutput.push(">>>ServerNames from FilterChain "+i+" in first configset not found in second configset")
            additionalOutput.push(...serverNames1)
          }
        })
        serverNamesList2.forEach((serverNames2, i) => {
          let found = false
          for(const serverNames1 of serverNamesList1) {
            if(JsonUtil.compareFlatArrays(serverNames1, serverNames2)) {
              found = true
              break
            }
          }
          if(!found) {
            diffs.push("{-->} filter_chains["+i+"] - server_names mismatch")
            additionalOutput.push(">>>ServerNames from FilterChain "+i+" in second configset not found in first configset")
            additionalOutput.push(...serverNames2)
          }
        })
        if(diffs.length > 0) {
          otherDiffPairs.push(pair)
          pair.push(diffs)
        }
      }
    } else {
      !listener1.listener && diffs.push("{<<} listener missing")
      !listener2.listener && diffs.push("{>>} listener missing")
    }
  })
}

function identifyEnvoyConfigDiffs(diffPairs: any[], versionMismatchedPairs: any[], otherDiffPairs: any[], type: string, 
                                    additionalOutput: string[], ignoreKeys?: string[], ignoreValues?: string[]) {
  switch(type) {
    case EnvoyConfigType.Clusters:
      identifyEnvoyClusterDiffs(diffPairs, versionMismatchedPairs, otherDiffPairs, additionalOutput, ignoreKeys, ignoreValues)
      break;
    case EnvoyConfigType.Listeners:
      identifyEnvoyListenerDiff(diffPairs, versionMismatchedPairs, otherDiffPairs, additionalOutput, ignoreKeys, ignoreValues)
      break;
  }
}

export function compareEnvoyConfigs(onStreamOutput, configs1: any[], configs2: any[], type: string, 
                                  transform: boolean, valuesToIgnore?: string[]) {
  const output: ActionOutput = []
  const items = {}
  const diffs = {}
  const matchingRecords: string[] = []
  const keysToIgnore: string[] = ["mixer_attributes", "uid", "type", "last_updated", "status", "version_info", 
                                  "mixerAttributes", "lastUpdated", "status", "versionInfo", "title"]

  const normalizeName = (name, index) => valuesToIgnore && name.startsWith(valuesToIgnore[index]) ? name.replace(valuesToIgnore[index], "xxx") : name

  let name1, name2
  configs1.forEach(c1 => {
    name1 = c1.name || c1.title || c1
    name1 = normalizeName(name1, 0)
    items[name1]=[[c1], ["Missing"]]
  })

  configs2.forEach(c2 => {
    name2 = c2.name || c2.title || c2
    name2 = normalizeName(name2, 1)
    const config2Item = transform ? JsonUtil.transformObject(c2) : c2
    if(items[name2]) {
      const c1 = items[name2][0][0]
      const config1Item = transform ? JsonUtil.transformObject(c1) : c1
      items[name2][0].push(config1Item)
      const itemDiffs: string[] = []
      const matches = JsonUtil.compareObjects(config1Item, config2Item, itemDiffs, keysToIgnore, valuesToIgnore)
      if(matches) {
        name1 = c1.name || c1.title || c1
        matchingRecords.push(name1 === name2 ? name1 : name1 + " <---> " + name2)
        delete items[name2]
      } else {
        diffs[name2] = itemDiffs
        items[name2][1]=[c2, config2Item]
      }
    } else {
      items[name2] = [["Missing"], [c2, config2Item]]
    }
  })

  output.push([">Matching "+type, ""])
  matchingRecords.length === 0 && output.push([">>No matching "+type, ""])
  matchingRecords.forEach(c => output.push(["<<", c, ""]))

  if(Object.keys(items).length > 0) {
    const diffPairs: any[] = []
    Object.keys(items).forEach(name => {
      diffPairs.push([items[name][0][0], items[name][1][0]])
    })
    const versionMismatchedPairs: any[] = []
    const otherDiffPairs: any[] = []
    const additionalOutput: string[] = []
    identifyEnvoyConfigDiffs(diffPairs, versionMismatchedPairs, otherDiffPairs, type, additionalOutput, keysToIgnore, valuesToIgnore)

    if(versionMismatchedPairs.length > 0) {
      output.push([">Version Mismatched "+type, ""])
      versionMismatchedPairs.forEach(pair => {
        const name = pair[0].name || pair[0].title || pair[0]
        output.push(["<<", name, ""])
      })
    }
    if(otherDiffPairs.length > 0) {
      output.push([">Mismatched "+type, ""])
      otherDiffPairs.forEach(pair => {
        const c1 = pair[0]
        const c2 = pair[1]
        const diffs = pair[2]
        const name1 = c1.name || c1.title || c1
        const name2 = c2.name || c2.title || c2
        output.push([">>"+(name1 || 'N/A'), (name2||'N/A')])
        output.push(["<<", c1, c2])
        if(additionalOutput.length > 0) {
          output.push([">>>Diffs"])
          //output.push(["<<", diffs])
          additionalOutput.forEach(o => output.push([o]))
        }
      })
    }
    if(versionMismatchedPairs.length === 0 && otherDiffPairs.length === 0) {
      output.push([">>Unanalyzed Config Difference", ""])
      diffPairs.forEach(pair => output.push(
        [">>>" + (pair[0].name || pair[1].name)], ["<<", pair[0], pair[1]])
      )
    }
  } else {
    output.push([">>No Mismatched "+type, ""])
  }
  onStreamOutput(output)
}

export async function compareTwoEnvoys(namespace1: string, pod1: string, container1: string, k8sClient1,
                                namespace2: string, pod2: string, container2: string, k8sClient2, onStreamOutput) {

  const pod1Details = await K8sFunctions.getPodDetails(namespace1, pod1, k8sClient1)
  const pod1IP = pod1Details && pod1Details.podIP
  const pod2Details = await K8sFunctions.getPodDetails(namespace2, pod2, k8sClient2)
  const pod2IP = pod2Details && pod2Details.podIP

  const valuesToIgnore: string[] = []
  pod1IP && valuesToIgnore.push(pod1IP)
  pod2IP && valuesToIgnore.push(pod2IP)

  const envoy1Bootstrap = await EnvoyFunctions.getEnvoyBootstrapConfig(k8sClient1, namespace1, pod1, container1)
  const envoy2Bootstrap = await EnvoyFunctions.getEnvoyBootstrapConfig(k8sClient2, namespace2, pod2, container2)
  compareEnvoyConfigs(onStreamOutput, envoy1Bootstrap, envoy2Bootstrap, EnvoyConfigType.Bootstrap, false, valuesToIgnore)

  let envoy1Listeners = await EnvoyFunctions.getEnvoyListeners(k8sClient1, namespace1, pod1, container1)
  envoy1Listeners = envoy1Listeners.filter(l => l.title.includes("active"))
  let envoy2Listeners = await EnvoyFunctions.getEnvoyListeners(k8sClient2, namespace2, pod2, container2)
  envoy2Listeners = envoy1Listeners.filter(l => l.title.includes("active"))
  compareEnvoyConfigs(onStreamOutput, envoy1Listeners, envoy2Listeners, EnvoyConfigType.Listeners, false, valuesToIgnore)

  const envoy1Routes = await EnvoyFunctions.getEnvoyRoutes(k8sClient1, namespace1, pod1, container1)
  const envoy2Routes = await EnvoyFunctions.getEnvoyRoutes(k8sClient2, namespace2, pod2, container2)
  compareEnvoyConfigs(onStreamOutput, envoy1Routes, envoy2Routes, EnvoyConfigType.Routes, false, valuesToIgnore)

  const envoy1Clusters = await EnvoyFunctions.getEnvoyClusters(k8sClient1, namespace1, pod1, container1)
  const envoy2Clusters = await EnvoyFunctions.getEnvoyClusters(k8sClient2, namespace2, pod2, container2)
  compareEnvoyConfigs(onStreamOutput, envoy1Clusters, envoy2Clusters, EnvoyConfigType.Clusters, false, valuesToIgnore)
}


const plugin : ActionGroupSpec = {
  context: ActionContextType.Istio,
  title: "Envoy Proxy Recipes",
  order: ActionContextOrder.Istio+3,
  actions: [
    {
      name: "Compare Envoy Configs",
      order: 30,
      loadingMessage: "Loading Envoy Proxies...",

      choose: ChoiceManager.chooseEnvoyProxy.bind(ChoiceManager, 2, 2),

      async act(actionContext) {
        const sidecars = ChoiceManager.getSelectedEnvoyProxies(actionContext)
        const sidecar1 = sidecars[0]
        const sidecar2 = sidecars[1]

        this.onOutput && this.onOutput([["Sidecar Config Comparison for " + 
          sidecar1.pod+"."+sidecar1.namespace+"@"+sidecar1.cluster + " and " +
          sidecar2.pod+"."+sidecar2.namespace+"@"+sidecar2.cluster, 
          ""]], ActionOutputStyle.Mono)
        this.showOutputLoading && this.showOutputLoading(true)

        const cluster1 = actionContext.getClusters().filter(c => c.name === sidecar1.cluster)[0]
        const cluster2 = actionContext.getClusters().filter(c => c.name === sidecar2.cluster)[0]
        await compareTwoEnvoys(sidecar1.namespace, sidecar1.pod, "istio-proxy", cluster1.k8sClient,
                        sidecar2.namespace, sidecar2.pod, "istio-proxy", cluster2.k8sClient, this.onStreamOutput)

        this.showOutputLoading && this.showOutputLoading(false)
      },
      refresh(actionContext) {
        this.act(actionContext)
      }
    }
  ]
}

export default plugin
