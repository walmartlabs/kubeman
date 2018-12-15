"use strict";
const _ = require('lodash')
const jsonUtil = require('../../util/jsonUtil')
const k8sFunctions = require('../../k8s/k8sFunctions')
const k8sComparisonUtil = require('../../k8s/k8sComparisonUtil')

module.exports = {
  context: "Pod",
  actions: [
    {
      name: "Compare Two Pods",
      order: 1,

      choose(actionContext) {
        k8sComparisonUtil.prepareChoices(actionContext, 
          (cluster, namespace, k8sClient) => {
            const namespaces = actionContext.getNamespaces()
            const pods = _.flatMap(namespaces.filter(ns => 
              ns.cluster.name === cluster && ns.name === namespace),
              ns => ns.pods.map(pod => pod.name))

            return k8sFunctions.getPodsDetails(namespace, pods, k8sClient)
          },
        "Pods", 2, 2, "name")
      },

      async act(actionContext) {
        k8sComparisonUtil.prepareOutput(actionContext, "Pods")
      },
    }
  ]
}
