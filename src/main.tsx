import Didact from './core'

interface Props {
  name: string
}

/** @jsx Didact.createElement */
function App(props: Props) {
  const { name } = props

  return <div>name: {name}</div>
}

Didact.render(<App name="foo" />, document.getElementById('root'))
