function createElement<P>(
  type: string,
  props: P | null,
  ...children: DidactNode[]
): DidactElement {
  return {
    type,
    props: {
      ...props,
      children,
    },
  }
}

export { createElement }
