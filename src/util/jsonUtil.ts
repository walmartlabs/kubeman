const globalRequire = global['require']
const jp = globalRequire('jsonpath')
const _ = globalRequire('lodash')

export default class JsonUtil {
  static isText(content) : content is string {
    return typeof content === 'string'
  }

  static isObject(content) : boolean {
    return (!(content instanceof Array) && typeof content === 'object') ||
            (typeof content === 'string' && content.trim().startsWith("{") && content.trim().endsWith("}"))
  }


  static isArray(content) : boolean {
    return content instanceof Array ||
            (typeof content === 'string' && content.trim().startsWith("[") && content.trim().endsWith("]"))
  }


  private static _extract(multi, json, path, ...keys) {
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

  static extract = JsonUtil._extract.bind(null, false)
  static extractMulti = JsonUtil._extract.bind(null, true)

  private static _convertObjectToArray(level, flatten, object) {
    if(!object) {
      return []
    }
    if(object instanceof Array) {
      return object.map(item => JsonUtil._convertObjectToArray(level+1, flatten, item))
    } else if(typeof object === 'object')  {
      const fields: any[] = []
      Object.keys(object).forEach((key, i) => {
        if(flatten) {
          i === 0 && fields.push(object[key])
          i === 1 && fields.push(fields.pop() + ": " + JsonUtil._convertObjectToArray(level+1, false, object[key]))
          i > 1 && JsonUtil._convertObjectToArray(level+1, false, object[key])
        } else {
          fields.push((level > 0 && level % 2 === 0 ? " | " : " ") + key 
                      + (level % 2 === 0 ? ": " : "") + JsonUtil._convertObjectToArray(level+1, false, object[key]))
        }
      })
      return fields
    } else {
      return level === 0 ? [object.toString()] : object.toString()
    }
  }
  static convertObjectToArray = JsonUtil._convertObjectToArray.bind(null, 0, false)
  static convertObjectToString(object) {
    return JsonUtil._convertObjectToArray(0, true, object)
            .map(item => item instanceof Array ? item.join("; ") : 
                          typeof item === 'string' ? (item as string).replace(',', ' ') : 
                          JsonUtil.convertObjectToString(item))
            .join(". ")
  }

  static flattenObject(object) {
    if(object) {
      if(object instanceof Array) {
        return object.map(JsonUtil.flattenObject)
      } else if(typeof object === 'object') {
        const result = {}
        Object.keys(object).forEach(key => {
          let value = JsonUtil.flattenObject(object[key])
          if(value) {
            if(typeof value === 'object' && !(value instanceof Array)) {
              Object.keys(value).forEach(subkey => {
                result[key+"."+subkey] = value[subkey]
              })
            } else {
              result[key] = value
            }
          }
        })
        return result
      }
    }
    return object
  }
}