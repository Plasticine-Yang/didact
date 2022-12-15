# Didact

参考[build your own react](https://pomb.us/build-your-own-react/)实现的一个极简版 React

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
