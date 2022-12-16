import { isProperty } from './utils'

/** @description 记录下一个工作单元 -- 供 workLoop 函数调度 */
let nextUnitOfWork: Fiber | null = null

/** @description 记录执行的 fiber tree 的 root fiber */
let wipRoot: Fiber | null = null

function render(element: DidactElement, container: HTMLElement) {
  // 创建 root fiber
  wipRoot = {
    child: null,
    parent: null,
    sibling: null,
    dom: container,
    type: 'ROOT_ELEMENT',
    props: {
      children: [element],
    },
  }

  nextUnitOfWork = wipRoot

  requestIdleCallback(workLoop)
}

/**
 * @description 根据 fiber 创建 DOM
 * @param fiber Fiber
 */
function createDOM(fiber: Fiber) {
  const { type, props } = fiber

  // 将 element 转成真实 DOM -- 需要注意对于文本节点类型的处理
  const dom =
    type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(type)

  // 把 element.props 赋值到 DOM 元素上
  Object.keys(props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = props[name]
    })

  return dom
}

/**
 * @description 循环执行工作单元
 */
function workLoop(deadline: IdleDeadline) {
  let shouldYield = false

  while (nextUnitOfWork && !shouldYield) {
    // 执行工作单元并生成下一个工作单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)

    // 时间片的剩余时间不足时将控制权交回给浏览器
    if (deadline.timeRemaining() < 1) {
      shouldYield = true
    }
  }

  // 工作单元执行结束后判断是否生成了完整的 fiber tree，是的话进入 commit 阶段
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  // 剩下的工作单元放到之后的时间片中处理
  requestIdleCallback(workLoop)
}

/**
 * @description 执行工作单元并生成下一个工作单元
 * @param fiber 工作单元
 */
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // - 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
  if (!fiber.dom) {
    // 不存在 dom 的则先创建 DOM
    fiber.dom = createDOM(fiber)
  }

  // - 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
  const elements = fiber.props.children

  // 记录前一个 sibling fiber -- 用于完善 fiber 之间的 sibling 引用指向
  let prevSibling: Fiber | null = null

  for (let i = 0; i < elements.length; i++) {
    const element = elements.at(i)

    // 为 element 创建 fiber 对象
    const newFiber: Fiber = {
      type: element.type,
      props: element.props,
      child: null,
      parent: fiber,
      sibling: null,
      dom: null,
    }

    // 完善 fiber 指向关系
    if (i === 0) {
      // 第一个子元素对应的 newFiber 作为 fiber.child
      fiber.child = newFiber
    } else {
      // 后续子元素依次作为前一个子元素的 sibling
      prevSibling.sibling = newFiber
    }

    // 当前创建的 newFiber 在下一次循环中作为下一个 fiber 的 prevSibling
    prevSibling = newFiber
  }

  // - 寻找并返回下一个工作单元 fiber 对象

  // 优先寻找 fiber.child
  if (fiber.child) return fiber.child

  // 没有 child 则寻找 sibling
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling

    // 没有 sibling 则返回到 parent
    nextFiber = nextFiber.parent
  }

  // 最后回到 root fiber 时，nextFiber 会指向 root fiber 的 parent，也就是 null
  return nextFiber
}

/**
 * @description commit 阶段入口 -- 将生成的完整 fiber tree 渲染到视图上
 */
function commitRoot() {
  // 将生成的完整 fiber tree 渲染到视图上
  commitWork(wipRoot.child)

  // 将已 commit 的 fiber tree 置空，表明其已经被 commit 过了
  wipRoot = null
}

/**
 * @description 将 fiber 对应的 DOM 渲染到视图上
 */
function commitWork(fiber: Fiber) {
  // base case
  if (!fiber) return

  // 将当前 fiber 渲染到视图上
  const parentDOM = fiber.parent.dom
  parentDOM.appendChild(fiber.dom)

  // 递归地将 fiber child 和 sibling 渲染到视图上
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

export { render }
