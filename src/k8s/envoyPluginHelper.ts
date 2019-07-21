/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import _ from 'lodash'
import {K8sClient} from './k8sClient'
import {ActionOutput} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import IstioFunctions from '../k8s/istioFunctions'
import JsonUtil from '../util/jsonUtil'


export default class EnvoyPluginHelper {

  static outputClusterConfig(onStreamOutput, configs: any[]) {
    const output: ActionOutput = []
    const clustersByType = {}
    configs.forEach(config => {
      const cluster = config.cluster
      clustersByType[cluster.type] = (clustersByType[cluster.type] || [])
      clustersByType[cluster.type].push(config)
    })
    Object.keys(clustersByType).forEach(type => {
      const clusterConfigsForType = clustersByType[type]
      output.push([">Cluster Type: "+type + " ("+clusterConfigsForType.length+" items)"])
      clusterConfigsForType.forEach(config => {
        const cluster = config.cluster
        output.push([">>"+config.title])
        output.push([{
          metadata: cluster.metadata && cluster.metadata.filter_metadata,
          version_info: config.version_info,
          lastUpdated: config.lastUpdated, 
          connect_timeout: cluster.connect_timeout,
        }])
        cluster.eds_cluster_config && output.push([">>>EDS Config"], [cluster.eds_cluster_config])
        cluster.circuit_breakers && output.push([">>>Circuit Breakers"], [cluster.circuit_breakers])
        cluster.tls_context && output.push([">>>TLS Context"], [cluster.tls_context])
        config.status && output.push([">>>Status"], [config.status])
      })
    })
    onStreamOutput(output)
  }

  static outputListenerConfig(onStreamOutput, configs: any[]) {
    const output: ActionOutput = []
    configs.forEach(config => {
      const listener = config.listener
      const fcCount = listener.filter_chains ? listener.filter_chains.length : 0
      output.push([">"+config.title + " Last Updated: "+config.last_updated + " ("+fcCount+" filter chains)"])
      if(listener.address && listener.address.socket_address) {
        output.push([">>Socket Address"])
        output.push([listener.address.socket_address])
      }
      if(listener.filter_chains) {
        listener.filter_chains.forEach((fc, i) => {
          const serverNames = fc.filter_chain_match ? fc.filter_chain_match.server_names : []
          const httpConnectionManager = fc.filters.filter(f => f.name.includes("envoy.http_connection_manager"))[0]
          const rdsRoute = httpConnectionManager && httpConnectionManager.config && httpConnectionManager.config.rds &&
                            httpConnectionManager.config.rds.route_config_name
          const fcTitle = "Filter Chain #" + (i+1) + 
          (serverNames && serverNames.length > 0 ? " [ "+serverNames.join(", ")+" ]" : "") + 
          (rdsRoute ? " -> RDS Route: [ "+rdsRoute+" ]" : "")
          output.push([">>"+fcTitle])
          if(fc.filter_chain_match) {
            output.push([{filter_chain_match: fc.filter_chain_match}])
          }
          if(fc.filters) {
            fc.filters.forEach(f => {
              output.push([">>>Filter: " + f.name])
              output.push([f])
            })
          }
        })
      }
    })
    onStreamOutput(output)
  }

  static outputRouteConfig(onStreamOutput, configs: any[]) {
    const output: ActionOutput = []
    configs.forEach(config => {
      output.push([">"+config.title + " Last Updated: "+config.last_updated])
      output.push([{"virtualHost.name": config.name, "virtualHost.domains": config.domains}])
      config.routes.forEach(r => {
        r.route && output.push([">>"+r.route.cluster])
        Object.keys(r).forEach(key => output.push([">>>"+key], [r[key]]))
      })
    })
    onStreamOutput(output)
  }
}