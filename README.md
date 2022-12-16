# Didact

## 前言

这是我阅读 [build your own react](https://pomb.us/build-your-own-react/) 过程中总结的自己的想法，该文章讲述了如何实现的一个极简版的 React，涵盖了 React 的核心特性，其中包括：

1. createElement 将 jsx 元素转成 element 对象
2. render 函数将 element 对象渲染成真实 DOM
3. concurrent mode 优化渲染任务
4. fiber 架构
5. 将渲染任务拆分成 render 和 commit 两个阶段
6. reconciliation 调和新老 fiber，实现一个简单的 diff 算法
7. 函数组件和 hooks

这篇文章真的写得很棒，对我们了解 React 的运行流程和设计原理有很大的帮助，也推荐大家去阅读~

我自己实现的版本会使用 TypeScript，并且使用 vite 方便查看效果

## 1. Didact 命名的含义

> We need a name that sounds like React but also hints its didactic purpose.

也就是说它是完全出于教学目的而创造的

## 2. MVP 版本

我们首先来实现一个 MVP 版本，也就是最小可用的版本，怎样才算是最小可用的呢？

以下面这个简单的 Demo 为例：

```tsx
const element = <div name="foo">foo</div>
Didact.render(element, document.getElementById('root'))
```

也就是要实现以下两个功能：

1. 能够将 jsx 转成对象
2. 有基本的渲染功能

为此我们需要先实现两个 API -- `createElement` 和 `render`

### 2.1. createElement

创建出来的 element 对象结构是怎样的？我们需要先定义好 element 对象的类型，这样方便后续使用

从 `const element = <div name="foo">foo</div>` 可以总结出，目前我们的 element 需要以下属性：

1. type -- 元素的类型，对于这里的原生 DOM 元素，其值为标签名，也就是 `div`
2. props -- 标签上的属性，是一个 object，比如 `{ name: 'foo' }`
3. props.children -- 标签内的元素，比如 `{ name: 'foo', children: ['foo'] }`

那么接下来我们就可以用 TypeScript 的 interface 去定义 element 对象的类型，将其命名为 `DidactElement`

`/src/core/types/index.d.ts`

```ts
interface DidactElement<P = any, T extends string = string> {
  type: T
  props: P
}
```

现在再去实现 `createElement` API

`/src/core/element.ts`

```ts
function createElement<P>(
  type: string,
  props: P | null,
  ...children: DidactElement[]
): DidactElement {
  return {
    type,
    props: {
      ...props,
      children,
    },
  }
}
```

#### 2.1.1. 检验效果

现在我们实现了 `createElement` 函数了，该如何检验效果呢？

可以在 jsDoc 中使用 `@jsx` 注释声明要使用什么函数来处理 `jsx` 的转换

```tsx
/** @jsx Didact.createElement */
const element = <div name="foo">foo</div>
console.log(element)
```

现在我们运行看看输出的 element 是什么

![createElement输出的DidactElement对象](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4f1747c2929d45e39ec6b917c6ab3649~tplv-k3u1fbpfcp-watermark.image?)

至此，我们的 MVP 版本的 createElement 就算完成啦~

### 2.2. render

接下来是 render 渲染函数，目前我们要做的事情很简单，就是将 `createElement` 创建出来的对象转成真实的 DOM，并添加到容器 DOM 元素上

```tsx
Didact.render(element, document.getElementById('root'))
```

#### 2.2.1. 基础实现

那么我们要做的事情可以归结为以下几点：

1. 将 element 转成真实 DOM
2. 把 element.props 赋值到 DOM 元素上
3. 把真实 DOM 加入到 container DOM 中

对应实现如下：

`/src/core/render.ts`

```ts
function render(element: DidactElement, container: HTMLElement): void {
  const { type, props } = element

  // 1. 将 element 转成真实 DOM
  const dom = document.createElement(type)

  // 2. 把 element.props 赋值到 DOM 元素上
  Object.keys(props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = props[name]
    })

  // 3. 把真实 DOM 加入到 container DOM 中
  container.appendChild(dom)
}
```

目前的一个渲染效果如下：

![渲染效果](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8628ad63c60347d1be9ae4343f5f3a5a~tplv-k3u1fbpfcp-watermark.image?)

目前我们还没有对 children 进行处理，因此最终渲染的结果中看不到 foo 这个文本节点，接下来我们就要处理它

#### 2.2.2. 处理 children

我们需要在我们的 render 函数中处理，遍历 children，将它们全部渲染出来，如何渲染呢？

现在回过头来思考以下 render 函数的作用，是不是 **将一个 DidactElement 转成真实 DOM，然后挂载到 contaienr DOM 元素中？**

那么我们可以利用这个函数的定义，递归地将 children 也渲染出来，只需要把最开始创建出来的 dom 引用的 DOM 元素作为 container 传入即可，就像下面这样：

```ts
const { type, props } = element
const { children } = props

// 渲染 children
;(children as DidactElement[]).forEach((child) => {
  render(child, dom)
})
```

现在我们再来看看渲染的效果：

![渲染错误](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/aa78122e3b724b57987f7e0ee689e1c3~tplv-k3u1fbpfcp-watermark.image?)

为什么会出错呢？根据报错的内容，貌似是 element 对象有点问题，我们在 render 函数的最开始输出一下 element 看看

```ts
function render(element: DidactElement, container: HTMLElement): void {
  console.log(element)
  // ...
}
```

![element对象](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5ff40ae4ee714095b12b7dd20fc72607~tplv-k3u1fbpfcp-watermark.image?)

原来是因为这里我们得到的是一个字符串 `foo`，并不是 DidactElement 对象，自然就会出现无法结构出 props.children 的情况了

看来我们需要修改 `createElement` 的实现，当遇到子元素不是 DidactElement 对象时，就将其转成 DidactElement，也就是要增加对 `children` 是非 object 情况的处理

##### 2.2.2.1. createElement 处理文本节点类型

首先添加一个 `DidactTextElement` 类型

`/src/core/types/index.d.ts`

```ts
interface DidactTextElement {
  type: 'TEXT_ELEMENT'
  props: {
    nodeValue: TextNode
    children: []
  }
}

type TextNode = string
type DidactNode = DidactElement | TextNode | null | undefined
```

这里添加了一个 `DidactNode` 类型，用于修正之前 createElement 中 children 参数的类型声明，之前我们把它定为是 `DidactElement[]` 类型，但实际上他还有可能是 string 类型，因此这里特地声明一个 DidactNode 类型作为 children 的类型

现在可以去修改对 children 的处理了

`/src/core/element.ts`

```ts
function createElement<P>(
  type: string,
  props: P | null,
  // 修正 children 的类型
  ...children: DidactNode[]
): DidactElement {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child),
      ),
    },
  }
}

function createTextElement(text: TextNode): DidactElement {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}
```

##### 2.2.2.2. render 处理文本节点类型

`/src/core/render.ts`

```ts
function render(element: DidactElement, container: HTMLElement): void {
  const { type, props } = element
  const { children } = props

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

  // 渲染 children
  ;(children as DidactElement[]).forEach((child) => {
    // 能进来 forEach 循环说明不会是 TextNode，所以可以将 dom 大胆断言为 HTMLElement
    render(child, dom as HTMLElement)
  })

  // 把真实 DOM 加入到 container DOM 中
  container.appendChild(dom)
}
```

现在就能正常渲染啦~

![children渲染效果](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ce473a40b6e041bea4aacfd9cfcf8d60~tplv-k3u1fbpfcp-watermark.image?)

至此，我们的 MVP 版本就算完成了

完整代码可自行 checkout mvp 分支查看

## 3. Concurrent Mode

### 3.1. MVP 版本中存在的问题 -- Didact MVP 版本 和 React 渲染性能对比

我们现在有如下的渲染场景：

```tsx
/**
 * @description 简单的渲染性能测试
 * @param nodeCount 第一层节点数量
 * @param maxNestedLevel 每个节点的最小嵌套层数
 * @param maxNestedLevel 每个节点的最大嵌套层数
 */
function renderBenchmark(
  nodeCount: number,
  minNestedLevel: number,
  maxNestedLevel: number,
) {
  // 生成复杂结构的 DidactElement
  const bigTree = new Array(nodeCount)
    .fill(0)
    .map(() => createNestedElement(randomInt(minNestedLevel, maxNestedLevel)))

  // 待渲染元素
  const element = Didact.createElement('div', null, ...bigTree)

  // 计时标签
  const didactRenderLabel = 'Didact render'
  const onLoadLabel = 'onload'

  // 开始计时
  console.time(didactRenderLabel)
  console.time(onLoadLabel)

  Didact.render(element, document.getElementById('root'))

  // 结束计时
  console.timeEnd(didactRenderLabel)
  window.addEventListener('load', () => {
    console.timeEnd(onLoadLabel)
  })
}

/**
 * @description 构造嵌套的元素
 * @param maxLevel 最大的嵌套层数
 * @param level 当前处在第几层
 */
const createNestedElement = (maxLevel: number, level = 0) => {
  if (level === maxLevel) return 'done'

  return Didact.createElement(
    'div',
    null,
    createNestedElement(maxLevel, level + 1),
  )
}

/** @description 生成左闭右开区间的随机整数 */
const randomInt = (start: number, end: number) =>
  ~~(Math.random() * (end - start) + start)
```

测试一下渲染 20000 个 div 元素，每个 div 元素的子元素层数为 30 到 100 层不等，这样的 DOM 结构算是比较复杂的了，看看大概耗时怎样

```tsx
// 渲染 20000 个 div 元素，每个 div 元素的子元素层数为 30 到 100 层不等
renderBenchmark(20000, 30, 100)
```

![didact渲染性能测试](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7a6e5fd3bff45de91514b96ef2fe648~tplv-k3u1fbpfcp-watermark.image?)

可以看到，`Didact.render` 的执行时间约为 3.6s，而 load 事件触发则需要等待约 10.3s 的时间

同样的场景，如果是 React 来完成会怎样呢？为了让这个 `renderBenchmark` 更通用，我们重构一下测试代码的编写

```tsx
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
```

然后现在再来分别测试一下 Didact MVP 版本和 React 的渲染性能

`Didact MVP`

```tsx
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
```

![didact渲染性能测试](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5a3ce7a239db43ddb5b6d699d9a0bf48~tplv-k3u1fbpfcp-watermark.image?)

`React`

```tsx
// 渲染 20000 个 div 元素，每个 div 元素的子元素层数为 30 到 100 层不等
renderBenchmark({
  nodeCount: 20000,
  minNestedLevel: 30,
  maxNestedLevel: 100,
  renderTimeLogLabel: 'react-render',
  loadEventTimeLogLabel: 'react-load',
  hostCreateElement: React.createElement,
  hostRender: ReactDOM.render,
})
```

![react渲染性能测试](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80759fc6cc8d43859b519674e94d48fb~tplv-k3u1fbpfcp-watermark.image?)

> 以上测试都是在禁用浏览器缓存的情况下运行的

这里翻车了，本来我以为 React 跑这个简单的测试会比我们的 Didact MVP 版本快的，但结果没想到慢了这么多，估计还是 React 底层有太多复杂的处理了，不过没关系，我想说的就是目前我们 MVP 版本的一个问题在于渲染复杂结构的 element 时，会出现如下问题：

Once we start rendering, we won’t stop until we have rendered the complete element tree. If the element tree is big, it may block the main thread for too long. And if the browser needs to do high priority stuff like handling user input or keeping an animation smooth, it will have to wait until the render finishes.

1. 一旦我们开始渲染，就一定要等到整个 element tree 渲染完成才能有后续操作，当遇到上面测试的这种复杂 element tree 时，就会阻塞我们的 js 主线程较长时间
2. 浏览器需要处理高优先级任务，比如处理用户输入或者正在渲染一个动画，需要保证流畅的动画效果，但这都会由于执行我们的 render 函数而长时间阻塞导致不能很好地处理高优先级任务

### 3.2 改进思路

关键代码就在这里：

```ts
// 渲染 children
;(children as DidactElement[]).forEach((child) => {
  // 能进来 forEach 循环说明不会是 TextNode，所以可以将 dom 大胆断言为 HTMLElement
  render(child, dom as HTMLElement)
})
```

目前我们的渲染是直接在 js 的主线程中执行的，从而出现上面说的阻塞的问题，那如果要是我们能把对 element tree 的渲染任务拆分成多个小的工作单元，并且把每个工作单元放到浏览器的空闲时间片中去执行，不就能解决上面的问题了吗？

这样我们就需要提供一种**渲染任务可中断**的能力，在每个工作单元结束时检查一下当前时间片的剩余时间是否足够执行下一个工作单元，不够的话直接将控制权交回给浏览器，让浏览器处理完高优先级任务，有空闲时间了，再继续我们的渲染任务，因此我们还要提供一种**渲染任务可恢复**的能力

总结下来就是要提供一种机制，该机制能够提供两种能力：

1. 渲染任务可中断
2. 渲染任务可恢复

React 采用了 `Concurrent Mode` 的方式解决这个问题，并使用 fiber 架构，将 fiber 作为上面说的工作单元，并使用内部的 `scheduler` 模块去调度工作单元的执行

这里我们也学 React，使用 fiber 架构作为工作单元，但是出于简化的目的，我们不会实现 scheduler 模块，而是使用浏览器原生提供的 [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)

它会将传入的回调放到浏览器空闲时执行，至于 React 为什么不使用 requestIdleCallback，在这个 [issue](https://github.com/facebook/react/issues/11171#issuecomment-417349573) 中有提到

![React不使用requestIdleCallback的原因](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/566ccdb45ba24002a75e22ba67232d47~tplv-k3u1fbpfcp-watermark.image?)

既然明确了思路，那我们就要开始干了！

### 3.3. workLoop

既然要把渲染任务拆分成多个任务单元，那肯定需要有一个循环去不断地执行这些工作单元，因此我们将原来的递归调用 render 渲染 children 的代码移除，并添加一个 workLoop 函数用于循环执行工作单元

workLoop 要做什么事情呢？

1. 启动一个循环，在循环体中执行工作单元，并且要更新下一个工作单元
2. 在时间片不足时应当交出线程控制权给浏览器

为此我们可以写出如下代码：

`/src/core/render.ts`

```ts
/** @description 记录下一个工作单元 -- 供 workLoop 函数调度 */
let nextUnitOfWork = null

function render(element: DidactElement, container: HTMLElement): void {
  // ...

  requestIdleCallback(workLoop)
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

  // 剩下的工作单元放到之后的时间片中处理
  requestIdleCallback(workLoop)
}

/**
 * @description 执行工作单元并生成下一个工作单元
 * @param unitOfWork 工作单元
 */
function performUnitOfWork(unitOfWork: any) {
  // TODO 执行工作单元并生成下一个工作单元
}
```

现在的问题是，工作单元到底是个啥玩意儿？我们要怎么执行它？由于目前不知道它是什么，因此只能先将其类型标记为 any，实际上工作单元就是 React 中重要的 fiber 对象！

## 4. Fiber 架构

为了更好地了解 Fiber 架构，接下来我们以渲染如下 DidactElement 为例

```tsx
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
```

### 4.1. 流程分析

我们的 render 函数现在的任务就是根据传入的 element 创建对应的 fiber 对象，将这个 fiber 对象作为 root fiber，并把它作为第一个工作单元，也就是要将 nextUnitOfWork 设置为 root fiber

至于后续的渲染任务，就会通过 workLoop 中的循环拆分到各个时间片中执行，每个时间片中执行若干次 performUnitOfWork 去执行工作单元

performUnitOfWork 需要做的事情可以归结为如下三个：

1. 将 DidactElement 对象转成 DOM
2. 为当前处理的 fiber 对应的 DidactElement 的 children 创建 fiber 对象，并将它们添加到我们的 root fiber 下，形成 fiber tree
3. 返回下一个要执行的工作单元 fiber 对象

### 4.2. Fiber 的结构

由于我们需要不断地执行当前工作单元，并寻找下一个要执行的工作单元，所以我们需要能够很方便地通过 fiber 对象找到下一个要执行的工作单元

在 React 中，fiber 的结构是这样的：

![Fiber结构](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/add8367e02874f2ea597e21a204d4f26~tplv-k3u1fbpfcp-watermark.image?)

这种结构我们可以很方便地寻找下一个 fiber 对象，比如我现在从 root 出发，沿着 child 引用可以找到 div，执行完后再沿着 child 找到 h1，然后再沿着 child 找到 p

p 没有 child 可以走了，那么接下来就找同一层的兄弟元素，沿着 sibling 不断前进并执行 performUnitOfWork 即可，直到 sibling 也没有时再沿着 parent 引用回到上一层，回到上一层后继续沿着 sibling 把该层的兄弟元素也执行完，最后再沿着 parent 引用回到上一层，一直如此遍历直到回到 root fiber 为止，这个时候整个 root fiber 构成的 fiber tree 就算渲染完成了

### 4.3. 编码实现

理解了现在的任务后我们可以开始着手编写代码实现了，首先要先定义一下 fiber 对象的类型，方便后续使用

#### 4.3.1. Fiber 类型定义

从上面的 Fiber 结构分析中我们首先可以写出如下 interface:

`/src/core/types/fiber.d.ts`

```ts
interface Fiber {
  child: Fiber | null
  sibling: Fiber | null
  parent: Fiber | null

  /** @description 用于通过 fiber 创建 DOM 使用 */
  dom: HTMLElement | Text | null

  props: {
    /** @description 用于为 children element 创建 fiber 对象使用 */
    children: FiberChild[]
  }
}

type FiberChild = DidactElement | DidactTextElement | null | undefined
```

并将它作为 performUnitOfWork 的工作单元类型

```tsx
/** @description 记录下一个工作单元 -- 供 workLoop 函数调度 */
let nextUnitOfWork: Fiber | null = null

/**
 * @description 执行工作单元并生成下一个工作单元
 * @param unitOfWork 工作单元
 */
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // TODO 执行工作单元并生成下一个工作单元
}
```

#### 4.3.2. 重构 render 函数

从上面的流程分析中我们能够知道，我们需要有一个函数将 element 对象转成 DOM，并且要在 render 函数中创建 root fiber

而实际上目前我们的 render 函数本身做的任务就是将 element 对象转成 DOM，因此我们可以重构一下，将它更名为 createDOM，并重新实现一个 render 函数负责创建 root fiber

`createDOM`

```ts
/**
 * @description 根据 fiber 创建 DOM
 * @param fiber Fiber
 */
function createDOM(fiber: Fiber) {
  const { type, props } = fiber
  const { children } = props

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
```

##### 4.3.2.1. 创建 root fiber

root fiber 中我们目前能够获取到的只有其对应的 DOM，也就是 container DOM 元素，并且将传入的 element 作为 children

后续会在 performUnitOfWork 中遍历 element 并创建对应 fiber 的

`/src/core/render.ts`

```ts
function render(element: DidactElement, container: HTMLElement) {
  // 创建 root fiber
  nextUnitOfWork = {
    child: null,
    parent: null,
    sibling: null,
    dom: container,
    type: 'ROOT_ELEMENT',
    props: {
      children: [element],
    },
  }

  requestIdleCallback(workLoop)
}
```

#### 4.3.3. performUnitOfWork

对于每一个工作单元，我们要做的事情如下：

1. 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
2. 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
3. 寻找并返回下一个工作单元 fiber 对象

##### 4.3.3.1. 添加 DOM 到父容器结点中

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // - 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
  if (!fiber.dom) {
    // 不存在 dom 的则先创建 DOM
    fiber.dom = createDOM(fiber)
  }

  if (fiber.parent) {
    // 上面对 fiber.dom 的预处理能够保证父 fiber 一定会有 DOM
    fiber.parent.dom!.appendChild(fiber.dom)
  }

  // TODO 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
  // TODO 寻找并返回下一个工作单元 fiber 对象
}
```

#### 4.3.3.2. 遍历 children 构造 fiber tree

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // - 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
  // ...

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

  // TODO 寻找并返回下一个工作单元 fiber 对象
}
```

#### 4.3.3.3. 寻找并返回下一个工作单元 fiber 对象

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // - 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
  // ...

  // - 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
  // ...

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
```

可以在 performUnitOfWork 打印一下每次工作时处理的 fiber.type，看看是否和我们前面设想的遍历顺序一样

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  console.log(fiber.type)

  // ...
}
```

![输出performUnitOfWork执行的fiber](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6f3f6764c66741b9a0c953dfb40a693f~tplv-k3u1fbpfcp-watermark.image?)

可以看到正是我们设想的遍历顺序，并且此时看看渲染的结果：

![渲染结果](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e9594fe663ff407382d17204d176299b~tplv-k3u1fbpfcp-watermark.image?)

也是符合我们在 `main.tsx` 中编写的 tsx 结构的
