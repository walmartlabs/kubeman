const jp = require('jsonpath')
const _ = require('lodash')

function isText(content) {
  return typeof content === 'string'
}
module.exports.isText = isText

function isObject(content) {
  return (!(content instanceof Array) && typeof content === 'object') ||
          (typeof content === 'string' && content.trim().startsWith("{") && content.trim().endsWith("}"))
}
module.exports.isObject = isObject


function isArray(content) {
  return content instanceof Array ||
          (typeof content === 'string' && content.trim().startsWith("[") && content.trim().endsWith("]"))
}
module.exports.isArray = isArray


function extract(multi, json, path, ...keys) {
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
  return json instanceof Array ? result :
        result ? (multi || result.length > 1) ? result : result[0] : undefined
}

module.exports.extract = extract.bind(null, false)
module.exports.extractMulti = extract.bind(null, true)

function convertObjectToArray(level, flatten, object) {
  if(!object) {
    return []
  }
  if(object instanceof Array) {
    return object.map(item => convertObjectToArray(level+1, flatten, item))
  } else if(typeof object === 'object')  {
    const fields = []
    Object.keys(object).forEach((key, i) => {
      if(flatten) {
        i === 0 && fields.push(object[key])
        i === 1 && fields.push(fields.pop() + ": " + convertObjectToArray(level+1, false, object[key]))
        i > 1 && convertObjectToArray(level+1, false, object[key])
      } else {
        fields.push(key + (level > 0 ? " > " : ": ") + convertObjectToArray(level+1, false, object[key]))
      }
    })
    return fields
  } else {
    return level === 0 ? [object.toString()] : object.toString()
  }
}
module.exports.convertObjectToArray = convertObjectToArray.bind(null, 0, false)

module.exports.convertObjectToString = function (object) {
  return convertObjectToArray(0, true, object)
          .map(item => item instanceof Array ? item.join(", ") : item)
          .join(", ")
}

module.exports.colorJSON = function(json) {
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
