export function parse(tokens) {
  let i = 0;
  function next() { return tokens[i++]; }
  function peek(offset = 0) { return tokens[i + offset]; }
  function skipEOL() { while (peek() && peek().type === "EOL") next(); }

  function expect(val) {
    skipEOL();
    const t = next();
    if (!t || t.value !== val) throw new Error(`Expected '${val}'`);
    return t;
  }

  function parseBlock() {
    skipEOL();
    expect("{");
    const body = [];
    while (peek() && peek().value !== "}") {
      skipEOL();
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
      skipEOL();
    }
    expect("}");
    skipEOL();
    return body;
  }

  function parseParams() {
    skipEOL();
    expect("(");
    const params = [];
    while (peek() && peek().value !== ")") {
      let name = next().value;
      let type = null;
      // Allow type annotation or just parameter name
      if (peek() && peek().value === ":") {
        next();
        type = next().value;
      }
      if (peek() && peek().value === ",") next();
      params.push({ name, type });
    }
    expect(")");
    return params;
  }

  // Helper: parse expressions (very basic, left-to-right, supports +, -, *, /, and string concat)
  function parseExpression() {
    let left = parsePrimary();
    if (left === null) return null;
    while (
     peek() &&
     peek().value !== ")" &&
     ["+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">="].includes(peek().value)
    ) {
      const op = next().value;
      const right = parsePrimary();
      if (right === null) break;
      left = { type: "BinaryExpr", op, left, right };
    }
    return left;
  }

function parsePrimary() {
  skipEOL();
  const token = peek();
  if (!token) throw new Error("Unexpected end of input");

  const t = next();
  if (t.value === "(") {
    const expr = parseExpression();
    expect(")");
    return expr;
  }

  if (t.type === "NUMBER" || t.type === "STRING") {
    return { type: "Literal", value: t.value };
  }

  if (t.type === "IDENT") {
    if (peek()?.value === "(") {
      next(); // skip '('
      const args = [];
      while (peek() && peek().value !== ")") {
        args.push(parseExpression());
        if (peek()?.value === ",") next();
      }
      expect(")");
      return { type: "CallExpr", name: t.value, args };
    }
    return { type: "Identifier", name: t.value };
  }

  if (t.value === "[") {
    const arr = [];
    while (peek()?.value !== "]") {
      arr.push(parseExpression());
      if (peek()?.value === ",") next();
    }
    expect("]");
    return { type: "ArrayLiteral", elements: arr };
  }

  if (t.value === "{") {
    const obj = [];
    while (peek()?.value !== "}") {
      const key = next().value;
      expect(":");
      const value = parseExpression();
      obj.push({ key, value });
      if (peek()?.value === ",") next();
    }
    expect("}");
    return { type: "ObjectLiteral", fields: obj };
  }

  throw new Error("Unexpected token in expression: " + t.value);
}

  function parseStatement() {
    skipEOL();
    let token = peek();
    if (!token) return null;

    // Import support
if (token.value === "import") {
  next();
  const pkg = next().value;
  let alias = null;
  if (peek()?.value === "as") {
    next();
    alias = next().value;
  }
  skipEOL();
  return { type: "Import", pkg, alias, line: token.line };
}

// Test block
if (token.value === "test") {
  next();
  const name = next().value;
  const body = parseBlock();
  return { type: "Test", name, body, line: token.line };
}

    // Exported function
    if (token.value === "export") {
      next();
      skipEOL();
      if (peek()?.value === "fn") {
        next();
        const name = next().value;
        const params = parseParams();
        let returnType = null;
        if (peek()?.value === ":") {
          next();
          returnType = next().value;
        }
        const body = parseBlock();
        return { type: "ExportFunc", name, params, returnType, body };
      }
    }

    // Variable declarations (support expressions and object literals)
    if (token.value === "let" || token.value === "const") {
      const kind = next().value;
      const name = next().value;
      expect("=");
      let value;
      if (peek()?.value === "{") {
        value = parsePrimary();
      } else {
        value = parseExpression();
      }
      skipEOL();
      return { type: "VarDecl", kind, name, value, line: token.line };
    }

    // Function definition
    if (token.value === "fn") {
      next();
      const name = next().value;
      const params = parseParams();
      let returnType = null;
      if (peek()?.value === ":") {
        next();
        returnType = next().value;
      }
      const body = parseBlock();
      return { type: "Func", name, params, returnType, body, line: token.line };
    }

    // Type definition
    if (token.value === "type") {
      next();
      const name = next().value;
      expect("=");
      // Only support object types for now
      expect("{");
      const fields = [];
      while (peek()?.value !== "}") {
        const fname = next().value;
        expect(":");
        const ftype = next().value;
        if (peek()?.value === ",") next();
        fields.push({ name: fname, type: ftype });
      }
      expect("}");
      skipEOL();
      return { type: "TypeDef", name, fields, line: token.line };
    }

    // If/else
    if (token.value === "if") {
  next();

  // 🧠 Support optional parentheses
  let condition;
  if (peek()?.value === "(") {
    next(); // skip '('
    condition = parseExpression();
    expect(")");
  } else {
    condition = parseExpression();
  }

  skipEOL();
  const body = parseBlock();

  let alternate = null;
  skipEOL();
  if (peek()?.value === "else") {
    next();
    skipEOL();
    if (peek()?.value === "if") {
      alternate = [parseStatement()];
    } else {
      alternate = parseBlock();
    }
  }

  return { type: "If", condition, body, alternate, line: token.line };
}

    // While
    if (token.value === "while") {
      next();
      expect("(");
      const condition = parseExpression();
      expect(")");
      skipEOL();
      const body = parseBlock();
      return { type: "While", condition, body, line: token.line };
    }

    // For
    if (token.value === "for") {
      next();
      expect("(");
      // for (let i = 0; i < 10; i = i + 1)
      const initKind = next().value; // let
      const initVar = next().value;
      expect("=");
      const initVal = next().value;
      expect(";");
      const condVar = next().value, condOp = next().value, condVal = next().value;
      expect(";");
      const stepVar = next().value;
      expect("=");
      const stepLeft = next().value;
      const stepOp = next().value;
      const stepRight = next().value;
      expect(")");
      skipEOL();
      const body = parseBlock();
      return {
        type: "For",
        initKind, initVar, initVal,
        condVar, condOp, condVal,
        stepVar, stepLeft, stepOp, stepRight,
        body,
        line: token.line
      };
    }

    // Foreach
    if (token.value === "foreach") {
      next();
      expect("(");
      const iter = next().value;
      expect("in");
      const arr = next().value;
      expect(")");
      skipEOL();
      const body = parseBlock();
      return { type: "Foreach", iter, arr, body, line: token.line };
    }

    // Say (support expressions)
    if (token.value === "say") {
      next();
      const expr = parseExpression();
      skipEOL();
      return { type: "Say", value: expr, line: token.line };
    }

    // Return (support expressions)
    if (token.value === "return") {
      next();
      const expr = parseExpression();
      skipEOL();
      return { type: "Return", value: expr, line: token.line };
    }

    // Show
    if (token.value === "show") {
      next();
      const name = next().value;
      skipEOL();
      return { type: "Show", name, line: token.line };
    }

    // Add (support expressions)
    if (token.value === "add") {
      next();
      const name = next().value;
      expect(",");
      const expr = parseExpression();
      skipEOL();
      return { type: "Add", name, value: expr, line: token.line };
    }

    // Push (support expressions)
    if (token.value === "push") {
      next();
      const name = next().value;
      expect(",");
      const expr = parseExpression();
      skipEOL();
      return { type: "Push", name, value: expr, line: token.line };
    }

    // Call
    if (token.value === "call") {
      next();
      const callee = next().value;
      const args = [];
      while (peek()?.type !== "EOL" && peek()) args.push(parseExpression());
      skipEOL();
      return { type: "Call", fnName: callee, args, line: token.line };
    }

    // Dotted call: file.write
// Top-level implicit call like: greet("Adi")
if (token.type === "IDENT" && peek(1)?.value === "(") {
  const fnToken = next(); // function name
  next(); // skip '('
  const args = [];
  while (peek() && peek().value !== ")") {
    args.push(parseExpression());
    if (peek()?.value === ",") next();
  }
  expect(")");
  skipEOL();
  return { type: "Call", fnName: fnToken.value, args, line: token.line };
}

    // Skip unknown
    while (peek() && peek().type !== "EOL") next();
    skipEOL();
    next();
    return null;
  }

  const ast = [];
  const functions = {};
  const imports = [];
  while (i < tokens.length) {
    skipEOL();
    const stmt = parseStatement();
    if (stmt) {
      if (stmt.type === "Func" || stmt.type === "ExportFunc") {
        functions[stmt.name] = stmt;
      } else if (stmt.type === "Import") {
        imports.push(stmt);
      } else {
        ast.push(stmt);
      }
    }
    skipEOL();
  }
  return { ast, functions, imports };
}
