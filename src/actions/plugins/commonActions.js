module.exports = {
  order: 1,
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
