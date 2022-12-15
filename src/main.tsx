import Didact from './core'

/** @jsx Didact.createElement */
const element = <div name="foo">foo</div>

Didact.render(element, document.getElementById('root'))
