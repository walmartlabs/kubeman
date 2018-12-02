const jp = require('jsonpath')
const jpExtract = require('../../util/jpExtract')

module.exports = {
  order: 4,
  context: "Pod",
  actions: [
    {
      name: "Get Pod Status",
      render(pod) {
        const output = []
        const statusResult = jpExtract.extract(pod, "$.status.containerStatuses[*]",
                        "name", "state")
      
        statusResult.forEach(result => {
          output.push([
            "Pod: " + pod.metadata.name,
            "Container: " + result.name,
            "Status: " + JSON.stringify(result.state)])
        })
        return output
      }
    }
  ]
}