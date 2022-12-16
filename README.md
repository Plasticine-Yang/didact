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

## 5. render 和 commit 分离

### 5.1. 目前存在的问题

目前我们的 performUnitOfWork 中是边构造 fiber tree 边将生成的 DOM 挂载到容器节点中从而触发浏览器渲染，这样带来的一个严重问题就是在渲染复杂结构的 fiber tree 时，fiber tree 还没生成完就已经开始渲染了，也就是说用户会看到一个不完整的 UI

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // ...

  // fiber tree 构造的过程中夹杂着将 DOM 渲染到浏览器的过程
  if (fiber.parent) {
    fiber.parent.dom!.appendChild(fiber.dom)
  }

  // - 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
}
```

比如我们拿之前我们写的 renderBenchmark 测试一下，渲染 10000 个 30 到 100 层嵌套结构的 DOM 元素

```tsx
renderBenchmark({
  nodeCount: 10000,
  minNestedLevel: 30,
  maxNestedLevel: 100,
  hostCreateElement: Didact.createElement,
  hostRender: Didact.render,
})
```

![render和commit不分离的问题.gif](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2009278b831049dd95533e2c2e526318~tplv-k3u1fbpfcp-watermark.image?)

注意看右侧的滚动条，作为用户在浏览 UI 的时候，UI 还在动态生成，这样的用户体验不太好

为此，React 采用了构造 fiber tree 和 浏览器渲染分离的策略，我们把构造 fiber tree 视为 render，浏览器渲染视为将生成的 fiber tree 渲染到视图上，也称为 commit

也就是将原来的 render 函数拆分成 render 和 commit 阶段，前者负责构造 fiber tree，执行的都是一些 js 操作，后者负责提交生成的 fiber tree，使其渲染到浏览器视图上

### 5.2. 引入 wipRoot

首先，我们要把真实 DOM 操作的代码从 render 函数中移除。

其次，因为我们的 fiber tree 生成的过程是可中断的，为了保证在下次恢复执行时能够继续找到上次执行的 fiber tree 的 root fiber，我们需要利用闭包保存执行上下文环境的特性，声明一个 wipRoot 自由变量，让其指向执行的 fiber tree 的 root fiber

```ts
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
```

### 5.3. commitRoot

我们需要在 fiber tree 生成完成后进入 commit 阶段，通过调用 commitRoot 函数进入 commit 阶段，那么 commitRoot 函数应该在哪里调用呢？

只需要搞清楚何时生成完整的 fiber tree 即可，很显然是当遍历回 fiber root 的时候就代表整个 fiber tree 生成完了，此时 nextUnitOfWork 是 null，因此我们可以在 workLoop 中判断 nextUnitOfWork 不存在时执行 commitRoot

但是还有一点要注意，单纯判断 nextUnitOfWork 存在还不够，我们还要确保 commitRoot 的操作对象存在，也就是 wipRoot 要存在才行，因此改进的代码如下：

```ts
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
 * @description commit 阶段入口 -- 将生成的完整 fiber tree 渲染到视图上
 */
function commitRoot() {
  // TODO 将生成的完整 fiber tree 渲染到视图上
}
```

在 commitRoot 中，我们会递归地将 child 和 sibling 都渲染到视图上，所以我们还需要一个递归子函数 commitWork 去负责真正的渲染操作

并且在每次 commit 完成之后，应当将 wipRoot 置为 null，表明其已经被 commit 过

```ts
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
```

目前的渲染效果如下：

![render和commit分离后的效果.gif](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab312002895d4891a46088878a1696d9~tplv-k3u1fbpfcp-watermark.image?)

可以看到，开始的时候白屏是因为在构建 fiber tree，等 fiber tree 构建好后，会一次性被 commitRoot 将其渲染到视图上，符合我们的预期

## 6. Reconciliation

我们现在实现了对 DidactElement 的首次渲染，接下来还需要去实现对 DidactElement 的更新和移除

#### 6.1. 思路分析 -- 引入 currentRoot

首先我们要明确一下更新的思路，是不是应该尽可能地去复用我们的 fiber，最好是只更新变化的那部分，对于变化的那部分 fiber，我们可以让他们重新生成 DOM，而对于没有发生变化的 fiber，实际上可以直接复用已有的 DOM

为了做到这一点，我们应当实现一个 diff 算法，能够比对新旧 fiber，找出它们变化的 child，重新构造 fiber tree，并再处理完后将新的 fiber tree 提交给 commitRoot 去处理

既然如此，我们目前的重点就是去实现 diff 算法，而 diff 算法首先肯定要获取到新旧 fiber tree 才能比对新旧 fiber tree 中发生变化的 child 有哪些

新的 fiber tree 可以通过 render 函数调用时传入的 element 去生成，而老的 fiber tree 则可以利用闭包保留执行上下文环境的特性，每次 commit 结束时将 fiber tree 保留起来，方便下次更新时 diff 算法去使用

为此我们需要添加一个自由变量 `currentRoot`，它用于记录上次 commit 的 fiber tree 的 fiber root

```ts
/** @description 记录最后一次 commit 的 fiber tree 的 root fiber */
let currentRoot: Fiber | null = null
```

还要在每次 commitWork 结束的时候更新 currentRoot

```ts
/**
 * @description commit 阶段入口 -- 将生成的完整 fiber tree 渲染到视图上
 */
function commitRoot() {
  // 将生成的完整 fiber tree 渲染到视图上
  commitWork(wipRoot.child)

  // 更新 currentRoot
  currentRoot = wipRoot

  // 将已 commit 的 fiber tree 置空，表明其已经被 commit 过了
  wipRoot = null
}
```

### 6.2. 引入 alternate

光是能够获取到新旧 fiber tree 还不够，在我们生成新 fiber tree 的过程中，我们需要找出其对应的旧 fiber 节点，方便做节点之间的 diff，因此还需要在每次 commit fiber 的时候添加一个新的属性 -- `alternate`

因为是在 commit 阶段添加该属性的，这也就意味着在下次 commit 的时候访问该属性拿到的就是当前新 fiber 对应的旧 fiber 节点了

通过以上分析，我们给 Fiber 类型添加一个 alternate 属性，目前我们的 Fiber 长这样：

```ts
interface Fiber<T extends string = string> {
  child: Fiber | null
  sibling: Fiber | null
  parent: Fiber | null

  /** @description 用于通过 fiber 创建 DOM 使用 */
  dom: HTMLElement | Text | null

  // 为了方便让 createDOM 将原来的 element 转成 DOM 逻辑复用，因此让 fiber 的结构和 element 保持一致
  type: T

  props: {
    /** @description 用于为 children element 创建 fiber 对象使用 */
    children: FiberChild[]
  }

  /** @description 每个 fiber 对应的旧 fiber */
  alternate: Fiber | null
}
```

在什么时候赋值这个 alternate 属性呢？

首先对于 fiber root 来说，应当在创建 fiber root 的时候就赋值该属性了，也就是在 render 函数中

而语义上 fiber root 的 alternate 指的是最后依次 commit 时的 fiber root，那不就是自由变量 currentRoot 的值吗！

因此我们在 render 函数中修改如下：

```diff
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
+   alternate: currentRoot,
  }

  nextUnitOfWork = wipRoot

  requestIdleCallback(workLoop)
}
```

### 6.3. 怎么理解 reconciliation 调和？

其次，对于 child fiber，应当在遍历 elments 生成 fiber 对象的时候去添加 alternate 属性，也就是在 performUnitOfWork 函数中，但是这里我们不急着做这一步先，先停下来重构一下我们的代码，因为目前 performUnitOfWork 的代码有点长了，并且语义上现在是可以拆分的

也就是这个遍历 elements 生成 fiber tree 的过程实际上是一个调和(reconciliation)过程，调和是什么意思？我个人的理解就是让新旧 fiber tree 最大程度上保持一致，保持协调的过程，怎么理解呢？

也就是说生成新 fiber 的时候我们要尽可能复用旧 fiber 上已有的信息，让它们两者协调商量一下，把能用的都用上，避免重复劳动，比如旧 fiber 上保留有对应 DOM 的引用，而新 fiber 中如果发现对应的 DOM 其实没必要重新生成的话，直接将旧 fiber 的 dom 引用拿过来即可，不需要重新调用 DOM API 去生成一个一模一样的 DOM

综上所述，我们将 performUnitOfWork 的第二步 `遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree` 抽离成一个名为 `reconcileChildren` 的函数，在这里面专门负责调和新旧 fiber，这样能够提高我们代码的可读性，但前提是你要搞懂这些函数命名的意义才行

> 事实上重构前的代码也可以看成是一个调和的过程，只是没有旧 fiber 供它协调，因此全都只能自己单干

```ts
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // - 将 fiber 上的 DOM 添加到其父 fiber 的 DOM 中，也就是父 fiber 的 DOM 作为容器节点
  // ...

  // - 遍历子元素 FiberChild 对象，依次为它们创建 fiber 对象，并将 fiber 对象加入到当前工作单元 fiber 中，逐步构造 fiber tree
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)

  // - 寻找并返回下一个工作单元 fiber 对象
  // ...
}

/**
 * @description 调和 fiber children
 * @param wipFiber 新 fiber -- 由于尚未调和完毕，所以语义上命名为 wipFiber，即 work in progress fiber 更加合理
 * @param elements 待调和的 element
 */
function reconcileChildren(wipFiber: Fiber, elements: FiberChild[]) {
  // 记录前一个 sibling fiber -- 用于完善 fiber 之间的 sibling 引用指向
  let prevSibling: Fiber | null = null

  for (let i = 0; i < elements.length; i++) {
    const element = elements.at(i)

    // 为 element 创建 fiber 对象
    const newFiber: Fiber = {
      type: element.type,
      props: element.props,
      child: null,
      parent: wipFiber,
      sibling: null,
      dom: null,
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
```

### 6.4. effectTag

现在我们在 reconcileChildren 中可以获取到旧 fiber 以及待调和的 element，我们需要判断一下接下来需要对 element 做什么操作

无非就三种操作：

1. 更新
2. 新增
3. 删除

问题是我们要如何知道接下来要进行这三种操作的哪一种呢？我们来分类讨论一下：

#### 6.4.1. 何时更新？

何时需要更新？是不是只对旧 fiber 的 type 和待调和的 element 的 type 是同一个 type 的时候才有更新的必要？

比如旧 fiber 上的 type 是 div，在新的 element 中变成了 p，这种情况就没有更新的必要，因为旧 fiber 上的 dom 属性我们是不能复用的，没有复用的意义

只有当旧 fiber 上的 type 是 div，并且新的 element 中也仍然是 div 时才有更新的意义

#### 6.4.2. 何时新增？

何时需要新增？这个就简单了，如果旧 fiber 直接不存在，那这个时候 element 不就只有新增这一条路可以走了吗

#### 6.4.3. 何时删除？

何时需要删除？这个也很简单，如果旧 fiber 存在，且 element 不存在，则说明需要从视图上删除这个旧 fiber 对应的 DOM

### 6.5. 实现

#### 6.5.1. 扩展 Fiber 类型定义

通过以上的分析，我们能够知道何时做什么操作了，但是要代码也知道才行呀，所以我们现在又要给 fiber 拓展新的属性了

新增一个 `effectTag` 属性，并且我们约定：

- 需要更新时 effectTag 赋值为 `UPDATE`
- 需要新增时 effectTag 赋值为 `PLACEMENT`
- 需要删除时 effectTag 赋值为 `DELETION`

结合上面的分类讨论，我们通过三个分支去为 fiber 添加对应的 effectTag

但是这里要注意，对于更新和新增才有为 element 创建新 fiber 的必要，此时 effectTag 要放在新生成 fiber 上

而对于删除操作，并没有创建新 fiber 的必要，所以 effectTag 要放在旧 fiber 上

之后我们会统一在 commitWork 中通过 fiber 获取到 effectTag，从而知道要如何处理这个 fiber 对应的 DOM

我们先来修改 Fiber 的类型定义，添加 effectTag 属性

```ts
interface Fiber<T extends string = string> {
  child: Fiber | null
  sibling: Fiber | null
  parent: Fiber | null

  /** @description 用于通过 fiber 创建 DOM 使用 */
  dom: HTMLElement | Text | null

  // 为了方便让 createDOM 将原来的 element 转成 DOM 逻辑复用，因此让 fiber 的结构和 element 保持一致
  type: T

  props: {
    /** @description 用于为 children element 创建 fiber 对象使用 */
    children: FiberChild[]
  }

  /** @description 每个 fiber 对应的旧 fiber */
  alternate: Fiber | null

  /** @description commit 阶段要如何处理 fiber */
  effectTag: 'UPDATE' | 'PLACEMENT' | 'DELETION' | null
}
```

还需要在创建 fiber root 的时候初始化一下 effectTag

```ts
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
```

#### 6.5.2. 给 fiber 打上 effectTag

为了方便判断对 element 的操作，先来实现一个判断旧 fiber 和待调和 element 是否是同一 type 的工具函数

```ts
/** @description 检验新旧 fiber 是否是同一类型 为后续需要执行何种操作提供依据 */
const sameType = oldFiber && element && element.type === oldFiber.type
```

然后就是通过三个条件分支去创建 fiber 和设置 effectTag 属性了

```ts
let newFiber: Fiber | null = null

if (sameType) {
  // TODO 更新
}

if (element && !sameType) {
  // TODO 新增
}

if (oldFiber && !sameType) {
  // TODO 删除
}
```

##### 6.5.2.1. UPDATE effectTag

对于更新操作，我们需要为待调和 element 创建新的 fiber 对象，并打上 'UPDATE' effectTag

```ts
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
```

##### 6.5.2.2. PLACEMENT effectTag

对于新增操作，我们也需要为待调和 element 创建 fiber 对象，并打上 `PLACEMENT` effectTag

```ts
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
```

##### 6.5.2.3. DELETION effectTag

对于删除操作，我们不用创建新 fiber，只用给旧 fiber 打上 'DELETION' effectTag 即可

```ts
if (oldFiber && !sameType) {
  // 删除
  oldFiber.effectTag = 'DELETION'
}
```

至此，我们的 reconcileChildren 函数完整代码如下：

```ts
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
```

#### 6.5.3. commitWork 中根据 effectTag 做出不同操作

打上 effectTag 后，我们就能在 commit 阶段对 fiber 进行处理了

##### 6.5.3.1. UPDATE effectTag -- 简单 diff 算法

对于更新操作，算是整个 didact 中最复杂的部分了，所以我们抽出单独的一个函数去处理更新逻辑

```ts
function commitWork(fiber: Fiber) {
  // base case
  if (!fiber) return

  const parentDOM = fiber.parent.dom

  if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    // 更新 -- 传入新旧 fiber 的 props，并找出变化的部分去修改 DOM
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props)
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
  // TODO
}

type DidactDOM = HTMLElement | Text
```

updateDOM 中会进行一个简单的 diff 算法，大致逻辑如下：

1. 遍历旧 props 中的 event props，也就是诸如`onClick`、`onChange`这样的 property，移除不存在于新 props 中或者发生变化了的的这些 event props，并且要移除相应的事件监听器
2. 遍历旧 props，移除不存在于新 props 的 property
3. 遍历新 props，添加不存在于旧 props 的 property
4. 遍历新 props 中的 event props，添加不存在于旧 props 中的这些 event props，并添加相应的事件监听器

我们一步一步来实现，首先处理第 2、3 点，它们比较简单

```ts
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
```

这里有三个工具函数，`isProperty`、`isGone`、`isNew`

```ts
/** @description 判断是否是有效的 property */
const isProperty = (key: string) => key !== 'children'

/** @description 判断是否是新 props 中不存在的 property */
const isGone = (nextProps: Fiber['props']) => (key: string) =>
  !(key in nextProps)

/** @description 判断是否是旧 props 中不存在的 property */
const isNew = (prevProps: Fiber['props']) => (key: string) =>
  !(key in prevProps)
```

接下来是第 1、4 步

```ts
// 遍历旧 props 中的 event props，也就是诸如`onClick`、`onChange`这样的 property
// 移除不存在于新 props 中或者发生变化了的的这些 event props，并且要移除相应的事件监听器
Object.keys(prevProps)
  .filter(isEventPropertyKey)
  .filter((key) => !(key in nextProps) || isNew(prevProps)(key))
  .forEach((name) => {
    dom.removeEventListener(eventType(name), prevProps[name])
  })

// 遍历新 props 中的 event props，添加不存在于旧 props 中的这些 event props，并添加相应的事件监听器
Object.keys(nextProps)
  .filter(isEventPropertyKey)
  .filter(isNew(prevProps))
  .forEach((name) => {
    dom.addEventListener(eventType(name), nextProps[name])
  })
```

这里又出现了新的工具函数：`isEventPropertyKey` 和 `eventType`，并且对 `isProperty` 进行了调整

```ts
/** @description 判断是否是事件属性名 */
const isEventPropertyKey = (key: string) => key.startsWith('on')

/** @description 获取事件属性名 */
const eventType = (name: string) => name.toLowerCase().substring(2)

/** @description 判断是否是有效的 property */
const isProperty = (key: string) =>
  key !== 'children' && !isEventPropertyKey(key)
```

##### 6.5.3.2. PLACEMENT effectTag

在 commitWork 中继续添加对新增操作的处理

```ts
if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
  // 新增
  parentDOM.appendChild(fiber.dom)
}
```

##### 6.5.3.3. DELETION effectTag

同样在 commitWork 中继续添加对删除操作的处理

```ts
if (fiber.effectTag === 'DELETION') {
  // 删除
  parentDOM.removeChild(fiber.dom)
}
```

但是这里有个问题，思考一下，`DELETION`这个 effectTag 是不是在 reconcileChildren 的时候将其打在了旧 fiber tree 中，我们现在 commitWork 处理的是新 fiber tree，所以不可能获取到被打上 `DELETEION` effectTag 的 fiber，因此我们要额外维护一个 `deletions` 数组，记录需要删除的 fiber，并在打上 `DELETION` effectTag 的时候将 fiber 加入到 deletions 数组中

```ts
/** @description 记录需要被删除的 fiber */
let deletions: Fiber[] = []

function reconcileChildren(wipFiber: Fiber, elements: FiberChild[]) {
  // ...

  if (oldFiber && !sameType) {
    // 删除
    oldFiber.effectTag = 'DELETION'
    deletions.push(oldFiber)
  }

  // ...
}
```

然后在 commit 阶段入口将 deletions 中的 fiber 逐一删除，也就是在 commitRoot 中处理

```ts
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
```

至此，我们的 reconciliation 就算完成啦
