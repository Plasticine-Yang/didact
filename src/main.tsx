import Didact from './core'

/** @jsx Didact.createElement */
const el = (
  <div>
    <h1>
      <p />
      <a />
    </h1>

    <h2 />
  </div>
)
Didact.render(el, document.getElementById('root'))
