"use strict";
const k8sFunctions = require('../../k8s/k8sFunctions')
const k8sComparisonUtil = require('../../k8s/k8sComparisonUtil')

module.exports = {
  title: "Namespace Objects",
  context: "Namespace",
  actions: [
    {
      name: "Compare Two Secrets",
      order: 2,
      secrets: {},
      async choose(actionContext) {
        await k8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceSecrets, "Secrets", 2, 2, "name")
      },

      async act(actionContext) {
        k8sComparisonUtil.prepareOutput(actionContext, "Secrets", "name")
      },
    },
    {
      name: "Compare Two Services",
      order: 2,
      secrets: {},
      async choose(actionContext) {
        await k8sComparisonUtil.prepareChoices(actionContext, k8sFunctions.getNamespaceServices, "Services", 2, 2, "name")
      },

      async act(actionContext) {
        k8sComparisonUtil.prepareOutput(actionContext, "Secrets")
      },
    }
  ]
}