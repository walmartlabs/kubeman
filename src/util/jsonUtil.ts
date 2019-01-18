import jp from 'jsonpath'
import _ from 'lodash'
import { isNullOrUndefined } from 'util'

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

  static toObjectValuesArray(object) {
    if(object instanceof Array) {
      return _.flatten(object.map(value => this.toObjectValuesArray(value)))
    } else if(typeof object === 'object') {
      return _.flatten(Object.keys(object).map(key => this.toObjectValuesArray(object[key])))
    } else {
      return object
    }
  }

  static compareFlatArrays(arr1: any[], arr2: any[], inOrder: boolean = false) {
    if(isNullOrUndefined(arr1) !== isNullOrUndefined(arr2))
      return false
    
    if(!(arr1 instanceof Array) || !(arr2 instanceof Array))
      return false
    
    if(arr1.length !== arr2.length)
      return false

    if(inOrder) {
      if(arr1.filter((item,index) => arr2[index] === item).length < arr1.length)
        return false
    } else {
      if(arr1.filter(item => arr2.includes(item)).length < arr1.length)
        return false
    }
    
    return true
  }

  static compareObjects(obj1, obj2) {
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    
    if(!this.compareFlatArrays(keys1, keys2)) {
      return false
    }
    const allKeys = keys1
    keys2.forEach(k => !allKeys.includes(k) && allKeys.push(k))

    return allKeys.filter(k => {
      const value1 = obj1[k]
      const value2 = obj2[k]
      if(isNullOrUndefined(value1) !== isNullOrUndefined(value2)) {
        return false
      }
      if(typeof value1 !== typeof value2) {
        return false
      }
      if(typeof value1 === 'object') {
        return this.compareObjects(value1, value2)
      }
      return value1 === value2
    }).length === allKeys.length
  }

  static underScoreToCamelCaseTransformer(key: string) {
    let pieces = key.split("_")
    pieces = pieces.map((piece, index) => {
      if(index > 0) {
        piece = piece.charAt(0).toUpperCase() + piece.slice(1)
      }
      return piece
    })
    return pieces.join("")
  }

  static transformObject(obj, keyTransformer?: (string) => string) {
    if(!keyTransformer) {
      keyTransformer = this.underScoreToCamelCaseTransformer
    }

    if(typeof obj !== 'object')
      return obj

    if(obj instanceof Array)
      return obj.map(item => this.transformObject(item, keyTransformer))

    const result = {}
    Object.keys(obj).forEach(k => {
      const key = keyTransformer ? keyTransformer(k) : k
      let value = obj[k]
      if(typeof value === 'object') {
        value = this.transformObject(value, keyTransformer)
      }
      result[key] = value
    })
    return result
  }
}