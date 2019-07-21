/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

export default class DateUtil {
  static getAge(from: string) {
    const now = Date.now()
    let age: any = Math.round((now - Date.parse(from))/3600000)
    if(age > 24) {
      const days = Math.round(age/24)
      const hours = age - (days*24)
      age = days + "d" + (hours > 0 ? hours + "h" : "")
    } else {
      age = age + "h"
    }
    return age
  }
}