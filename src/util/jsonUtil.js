const jp = require('jsonpath')
const _ = require('lodash')

module.exports.extract = function(json, path, ...keys) {
  const result = jp.query(jp.apply(json, path, 
    value => {
      if(keys.length > 0) {
        const result = {}
        keys.forEach(key => result[key]=value[key])
        return result
      } else {
        return value
      }
    }), "$[*].value")
  return result ? result.length > 1 ? result : result[0] : undefined
}

module.exports.extractMulti = function(json, path, ...keys) {
  return jp.query(jp.apply(json, path, 
    value => {
      if(keys.length > 0) {
        const result = {}
        keys.forEach(key => result[key]=value[key])
        return result
      } else {
        return value
      }
    }), "$[*].value")
}

module.exports.convertObjectToArray = function (object) {
  if(object instanceof Array) {
    return object.map(convertObjectToArray)
  } else {
    const fields = []
    Object.keys(object).forEach(key => fields.push(key + ":" + object[key]))
    return fields
  }
}

module.exports.jsonColor = function(json) {
  replacer = (match, pIndent, pKey, pVal, pEnd) => {
    const key =  '<span class=json-key>'
    const val =  '<span class=json-value>'
    const bool = '<span class=json-boolean>'
    const str =  '<span class=json-string>'
    const isBool = ['true', 'false'].includes(pVal)
    const pValSpan = /^"/.test(pVal) ? str : isBool ? bool : val
    let r = pIndent || ''
    if (pKey)
        r = r + key + pKey.replace(/[": ]/g, '') + '</span>: '
    if (pVal)
        r = r + pValSpan + pVal + '</span>'
    return r + (pEnd || '')
  }
  const jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg
  return JSON.stringify(json, null, 2)
    .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(jsonLine, replacer)
}
