import Didact from './core'

/** @jsx Didact.createElement */
function Counter() {
  const [count, setCount] = Didact.useState(0)

  return (
    <div onClick={() => setCount((state) => state + 1)}>Count: {count}</div>
  )
}

Didact.render(<Counter />, document.getElementById('root'))
