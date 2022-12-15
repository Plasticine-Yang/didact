type JSXElementConstructor<P> = (props: P) => DidactElement<any, any> | null

interface DidactElement<
  P = any,
  T extends string | JSXElementConstructor<any> =
    | string
    | JSXElementConstructor<any>,
> {
  type: T
  props: P
}

type DidactNode = DidactElement | string | number | boolean | null | undefined
