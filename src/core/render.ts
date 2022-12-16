import {
  eventType,
  isEventPropertyKey,
  isGone,
  isNew,
  isProperty,
} from './utils'

/** @description 记录下一个工作单元 -- 供 workLoop 函数调度 */
let nextUnitOfWork: Fiber | null = null

/** @description 记录执行的 fiber tree 的 root fiber */
let wipRoot: Fiber | null = null

/** @description 记录最后一次 commit 的 fiber tree 的 root fiber */
let currentRoot: Fiber | null = null

/** @description 记录需要被删除的 fiber */
let deletions: Fiber[] = []

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
    alternate: currentRoot,
    effectTag: null,
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
  reconcileChildren(fiber, elements)

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
 * @description 调和 fiber children
 * @param wipFiber 新 fiber -- 由于尚未调和完毕，所以语义上命名为 wipFiber，即 work in progress fiber 更加合理
 * @param elements 待调和的 element
 */
function reconcileChildren(wipFiber: Fiber, elements: FiberChild[]) {
  // 旧 fiber 可以通过 alternate 属性获取 因为调和的是 children 所以要获取其子 fiber
  let oldFiber = wipFiber.alternate?.child

  // 记录前一个 sibling fiber -- 用于完善 fiber 之间的 sibling 引用指向
  let prevSibling: Fiber | null = null

  for (let i = 0; i < elements.length; i++) {
    const element = elements.at(i)

    let newFiber: Fiber | null = null

    /** @description 检验新旧 fiber 是否是同一类型 为后续需要执行何种操作提供依据 */
    const sameType = oldFiber && element && element.type === oldFiber.type

    if (sameType) {
      // 更新
      newFiber = {
        child: null,
        sibling: null,
        parent: wipFiber,

        // 复用旧 fiber 的 dom
        dom: oldFiber.dom,
        type: oldFiber.type,
        props: element.props,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }

    if (element && !sameType) {
      // 新增
      newFiber = {
        child: null,
        sibling: null,
        parent: wipFiber,
        dom: null,
        type: element.type,
        props: element.props,
        alternate: null,
        effectTag: 'PLACEMENT',
      }
    }

    if (oldFiber && !sameType) {
      // 删除
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    // 完善 fiber 指向关系
    if (i === 0) {
      // 第一个子元素对应的 newFiber 作为 fiber.child
      wipFiber.child = newFiber
    } else {
      // 后续子元素依次作为前一个子元素的 sibling
      prevSibling.sibling = newFiber
    }

    // 当前创建的 newFiber 在下一次循环中作为下一个 fiber 的 prevSibling
    prevSibling = newFiber
  }
}

/**
 * @description commit 阶段入口 -- 将生成的完整 fiber tree 渲染到视图上
 */
function commitRoot() {
  // 将 deletions 中的 fiber 删除
  deletions.forEach(commitWork)

  // 将生成的完整 fiber tree 渲染到视图上
  commitWork(wipRoot.child)

  // 更新 currentRoot
  currentRoot = wipRoot

  // 将已 commit 的 fiber tree 置空，表明其已经被 commit 过了
  wipRoot = null
}

/**
 * @description 将 fiber 对应的 DOM 渲染到视图上
 */
function commitWork(fiber: Fiber) {
  // base case
  if (!fiber) return

  const parentDOM = fiber.parent.dom

  if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    // 更新 -- 传入新旧 fiber 的 props，并找出变化的部分去修改 DOM
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props)
  }

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
    // 新增
    parentDOM.appendChild(fiber.dom)
  }

  if (fiber.effectTag === 'DELETION') {
    // 删除
    parentDOM.removeChild(fiber.dom)
  }

  // 递归地将 fiber child 和 sibling 渲染到视图上
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

/**
 * @description 找出新旧 fiber props 的 difference 后更新已有 DOM
 * @param dom 已有 DOM
 * @param prevProps 旧 fiber 的 props
 * @param nextProps 新 fiber 的 props
 */
function updateDOM(
  dom: DidactDOM,
  prevProps: Fiber['props'],
  nextProps: Fiber['props'],
) {
  // 遍历旧 props 中的 event props，也就是诸如`onClick`、`onChange`这样的 property
  // 移除不存在于新 props 中或者发生变化了的的这些 event props，并且要移除相应的事件监听器
  Object.keys(prevProps)
    .filter(isEventPropertyKey)
    .filter((key) => !(key in nextProps) || isNew(prevProps)(key))
    .forEach((name) => {
      dom.removeEventListener(eventType(name), prevProps[name])
    })

  // 遍历旧 props，移除不存在于新 props 的 property
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(nextProps))
    .forEach((name) => {
      dom[name] = ''
    })

  // 遍历新 props，添加不存在于旧 props 的 property
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // 遍历新 props 中的 event props，添加不存在于旧 props 中的这些 event props，并添加相应的事件监听器
  Object.keys(nextProps)
    .filter(isEventPropertyKey)
    .filter(isNew(prevProps))
    .forEach((name) => {
      dom.addEventListener(eventType(name), nextProps[name])
    })
}

export { render }
