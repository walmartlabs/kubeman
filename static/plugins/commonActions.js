module.exports = {
  context: "Common",
  actions: [
    {
      name: "Clear",
      act(onOutput) {
        onOutput([])
      }
    },
  ]
}
