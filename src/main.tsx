import Didact from './core'
import { renderBenchmark } from './examples/render-benchmark'

renderBenchmark({
  nodeCount: 10000,
  minNestedLevel: 30,
  maxNestedLevel: 100,
  hostCreateElement: Didact.createElement,
  hostRender: Didact.render,
})
