// type JSXElementConstructor<P> = (props: P) => DidactElement<any, any> | null

interface DidactElement<P = any, T extends string = string> {
  type: T
  props: P
}

interface DidactTextElement {
  type: 'TEXT_ELEMENT'
  props: {
    nodeValue: TextNode
    children: []
  }
}

type TextNode = string
type DidactNode = DidactElement | TextNode | null | undefined
