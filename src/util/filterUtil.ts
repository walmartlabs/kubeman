import deburr from 'lodash/deburr';

export function filter(filterText: string, items: any[], field?: string) {
  filterText = filterText ? deburr(filterText.trim()).toLowerCase() : ''
  const pieces = filterText.split(" or ").filter(piece => piece.length > 0)

  const filteredItems: Set<any> = new Set
  pieces.forEach(piece => {
    const words = piece.split(" ").filter(word => word.length > 0)
    let matches = items
    let negated = false
    words.forEach(word => {
      const isNot = word === "!"
      negated = negated || isNot
      if(!isNot) {
        matches = matches.filter(item => {
          if(item instanceof Array) {
            let isExcluded = false
            const matchedItems = item.map(item => {
              const isMatched = (field ? item[field] : item).toLowerCase().includes(word)
              isExcluded = isExcluded || negated && isMatched
              return negated ? !isMatched : isMatched
            })
            return isExcluded ? false : matchedItems.reduce((r1,r2) => r1||r2)
          } else {
            const isMatched = (field ? item[field] : item).toLowerCase().includes(word)
            return negated ? !isMatched : isMatched
          }
        })
      }
    })
    matches.forEach(item => filteredItems.add(item))
  })
  return Array.from(filteredItems)
}
