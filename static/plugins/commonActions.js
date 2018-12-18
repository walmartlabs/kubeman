module.exports = {
  context: "Common",
  actions: [
    {
      name: "Clear",
      act(actionContext) {
        actionContext.onOutput && actionContext.onOutput([])
      }
    },
  ]
}
