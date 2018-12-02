const jp = require('jsonpath')

module.exports = {
  order: 3,
  context: "Namespace",
  actions: [
    {
      name: "List Secrets",
      act() {
      },
      render(pod) {
        const output = []
        return output
      }
    }
  ]
}