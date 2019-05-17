import _ from 'lodash'
import {K8sClient} from './k8sClient'
import {ActionOutput} from '../actions/actionSpec'
import ActionContext from '../actions/actionContext'
import IstioFunctions from '../k8s/istioFunctions'
import JsonUtil from '../util/jsonUtil'


export default class EnvoyPluginHelper {

  static outputListenerConfig(onStreamOutput, configs: any[]) {
    const output: ActionOutput = []
    configs.forEach(config => {
      const listener = config.listener
      output.push([">"+config.title + " Last Updated: "+config.last_updated])
      if(listener.address && listener.address.socket_address) {
        output.push([">>Socket Address"])
        output.push([listener.address.socket_address])
      }
      if(listener.filter_chains) {
        listener.filter_chains.forEach((fc, i) => {
          const serverNames = fc.filter_chain_match ? fc.filter_chain_match.server_names : []
          const fcTitle = "Filter Chain #" + (i+1) + (serverNames.length > 0 ? " [ "+serverNames.join(", ")+" ]" : "")
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
   
}