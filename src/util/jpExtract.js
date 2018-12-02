const jp = require('jsonpath')
const _ = require('lodash')

module.exports.extract = function(json, path, ...keys) {
  return jp.query(jp.apply(json, path, 
    value => {
      const result = {}
      keys.forEach(key => result[key]=value[key])
      return result
    }), "$[*].value")

}
