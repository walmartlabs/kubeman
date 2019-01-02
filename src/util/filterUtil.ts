import deburr from 'lodash/deburr';

export function filter(filterText: string, items: any[], field?: string) {
  filterText = filterText ? deburr(filterText.trim()).toLowerCase() : ''
  const pieces = filterText.split("or")

  const filteredItems: Set<any> = new Set
  pieces.forEach(piece => {
    const words = piece.split(" ").filter(word => word.length > 0)
    let matches = items
    words.forEach(word => {
      matches = matches.filter(item => {
        if(item instanceof Array) {
          return item.map(item => (field ? item[field] : item).includes(word)).reduce((r1,r2) => r1||r2)
        } else {
          return (field ? item[field] : item).includes(word)
        }
      })
    })
    matches.forEach(item => filteredItems.add(item))
  })
  return Array.from(filteredItems)
}
