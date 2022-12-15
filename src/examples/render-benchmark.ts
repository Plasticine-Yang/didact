/**
 * @description 简单的渲染性能测试
 */
interface Config {
  /** @description 第一层节点数量 */
  nodeCount: number

  /** @description 每个节点的最小嵌套层数 */
  minNestedLevel: number

  /** @description 每个节点的最大嵌套层数 */
  maxNestedLevel: number

  /** @description 供 console.time 使用的渲染函数计时标签 */
  renderTimeLogLabel?: string

  /** @description 供 console.time 使用的 load 事件触发标签 */
  loadEventTimeLogLabel?: string

  hostCreateElement: (type: any, props: any, ...children: any) => any
  hostRender: (element: any, container: any) => void
}
function renderBenchmark(config: Config) {
  const {
    nodeCount,
    minNestedLevel,
    maxNestedLevel,
    renderTimeLogLabel = 'render',
    loadEventTimeLogLabel = 'onload',
    hostCreateElement,
    hostRender,
  } = config

  /**
   * @description 构造嵌套的元素
   * @param maxLevel 最大的嵌套层数
   * @param level 当前处在第几层
   */
  const createNestedElement = (maxLevel: number, level = 0) => {
    if (level === maxLevel) return 'done'

    return hostCreateElement(
      'div',
      null,
      createNestedElement(maxLevel, level + 1),
    )
  }

  // 生成复杂结构的 DidactElement
  const bigTree = new Array(nodeCount)
    .fill(0)
    .map(() => createNestedElement(randomInt(minNestedLevel, maxNestedLevel)))

  // 待渲染元素
  // const element = Didact.createElement('div', null, ...bigTree)
  const element = hostCreateElement('div', null, ...bigTree)

  // 开始计时
  console.time(renderTimeLogLabel)
  console.time(loadEventTimeLogLabel)

  hostRender(element, document.getElementById('root'))

  // 结束计时
  console.timeEnd(renderTimeLogLabel)
  window.addEventListener('load', () => {
    console.timeEnd(loadEventTimeLogLabel)
  })
}

/** @description 生成左闭右开区间的随机整数 */
const randomInt = (start: number, end: number) =>
  ~~(Math.random() * (end - start) + start)

export { renderBenchmark }
