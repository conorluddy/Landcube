/** Validates required interface elements and their expected DOM types at the boundary. */
export function getRequiredElement<ElementType extends Element>(
  parent: ParentNode,
  selector: string,
  elementConstructor: new () => ElementType,
): ElementType {
  const element = parent.querySelector(selector);

  if (!(element instanceof elementConstructor)) {
    throw new Error(
      `Required interface element "${selector}" is missing or has the wrong type. Check the panel markup.`,
    );
  }

  return element;
}
