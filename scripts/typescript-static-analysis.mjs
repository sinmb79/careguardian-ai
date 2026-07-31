import ts from "typescript";

export function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current)
    )
  ) {
    current = current.expression;
  }
  return current;
}

export function createStaticExpressionEvaluator(sourceFile) {
  const declarations = new Map();

  const collect = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const existing = declarations.get(node.name.text) ?? [];
      existing.push(node);
      declarations.set(node.name.text, existing);
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  function resolveConstInitializer(identifierOrName) {
    const name = typeof identifierOrName === "string"
      ? identifierOrName
      : ts.isIdentifier(identifierOrName)
        ? identifierOrName.text
        : undefined;
    if (!name) return undefined;
    const matches = declarations.get(name);
    return matches?.length === 1 ? matches[0].initializer : undefined;
  }

  function evaluateStringArray(node, resolving = new Set()) {
    const expression = unwrapExpression(node);
    if (!expression) return undefined;
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return undefined;
      const initializer = resolveConstInitializer(expression);
      if (!initializer) return undefined;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return evaluateStringArray(initializer, nextResolving);
    }
    if (!ts.isArrayLiteralExpression(expression)) return undefined;
    const values = [];
    for (const element of expression.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = evaluateStringArray(element.expression, resolving);
        if (!spread) return undefined;
        values.push(...spread);
        continue;
      }
      if (ts.isOmittedExpression(element)) {
        values.push("");
        continue;
      }
      const value = evaluateString(element, resolving);
      if (value === undefined) return undefined;
      values.push(value);
    }
    return values;
  }

  function evaluateString(node, resolving = new Set()) {
    const expression = unwrapExpression(node);
    if (!expression) return undefined;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return undefined;
      const initializer = resolveConstInitializer(expression);
      if (!initializer) return undefined;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return evaluateString(initializer, nextResolving);
    }
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = evaluateString(expression.left, resolving);
      const right = evaluateString(expression.right, resolving);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isTemplateExpression(expression)) {
      let value = expression.head.text;
      for (const span of expression.templateSpans) {
        const substitution = evaluateString(span.expression, resolving);
        if (substitution === undefined) return undefined;
        value += substitution + span.literal.text;
      }
      return value;
    }
    if (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(unwrapExpression(expression.expression))
    ) {
      const callTarget = unwrapExpression(expression.expression);
      if (callTarget.name.text === "join" && expression.arguments.length <= 1) {
        const values = evaluateStringArray(callTarget.expression, resolving);
        const separator = expression.arguments.length === 0
          ? ","
          : evaluateString(expression.arguments[0], resolving);
        return values && separator !== undefined ? values.join(separator) : undefined;
      }
      if (callTarget.name.text === "concat") {
        const head = evaluateString(callTarget.expression, resolving);
        if (head === undefined) return undefined;
        const tail = expression.arguments.map((argument) => evaluateString(argument, resolving));
        return tail.some((value) => value === undefined)
          ? undefined
          : head + tail.join("");
      }
    }
    return undefined;
  }

  function evaluatePropertyName(node) {
    const expression = unwrapExpression(node);
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
      return evaluateString(expression.argumentExpression);
    }
    return undefined;
  }

  function resolvesToGlobalObject(node, resolving = new Set()) {
    const expression = unwrapExpression(node);
    if (!expression) return false;
    if (
      ts.isIdentifier(expression) &&
      ["globalThis", "window", "self", "global"].includes(expression.text)
    ) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      if (resolving.has(expression.text)) return false;
      const initializer = resolveConstInitializer(expression);
      if (!initializer) return false;
      const nextResolving = new Set(resolving);
      nextResolving.add(expression.text);
      return resolvesToGlobalObject(initializer, nextResolving);
    }
    return false;
  }

  return {
    evaluatePropertyName,
    evaluateString,
    evaluateStringArray,
    resolveConstInitializer,
    resolvesToGlobalObject
  };
}
