import React from 'react'
import ReactDOM from 'react-dom'

import Didact from './core'
import { renderBenchmark } from './examples/render-benchmark'

// 渲染 20000 个 div 元素，每个 div 元素的子元素层数为 30 到 100 层不等
renderBenchmark({
  nodeCount: 20000,
  minNestedLevel: 30,
  maxNestedLevel: 100,
  renderTimeLogLabel: 'didact-render',
  loadEventTimeLogLabel: 'didact-load',
  hostCreateElement: Didact.createElement,
  hostRender: Didact.render,
})
