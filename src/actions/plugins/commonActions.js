module.exports = {
  order: 1,
  context: "Common",
  actions: [
    {
      name: "Clear",
      render() {
        return []
      }
    },
    {
      name: "Generate Sample Output",
      outputStyle: 'Health',
      render() {
        const lines = []
        lines.push(["header 1", "header 2", "header 3", "health"])
        lines.push(["subheader 1", "---", "---", "---"])
        lines.push(["This is line 1, col 1", "This is line 1, col 2", "This is line 1, col 3", "healthy"])
        lines.push(["This is line 2, col 1", "This is line 2, col 2", "This is line 2, col 3", "unhealthy"])
        lines.push(["subheader 1", "---", "---", "---"])
        lines.push(["This is line 3, col 1", "This is line 3, col 2", "This is line 3, col 3", "down"])
        lines.push(["This is line 3, col 1", "This is line 3, col 2", "This is line 3, col 3", "up"])
        lines.push(["subheader 1", "---", "---", "---"])
        lines.push(["This is line 3, col 1", "This is line 3, col 2", "This is line 3, col 3", "good"])
        lines.push(["This is line 3, col 1", "This is line 3, col 2", "This is line 3, col 3", "bad"])
        return lines
      }
    },
  ]
}
