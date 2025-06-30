export function tokenize(code) {
  code = code.replace(/\/\/.*$/gm, "");
  code = code.replace(/}/g, "}\n");
  code = code.replace(/;/g, ";\n");
  const lines = code.split(/\r?\n/);
  const tokens = [];

  let lineNumber = 1;
  for (let line of lines) {
    const originalLine = line;
    line = line.trim();
    if (!line) {
      lineNumber++;
      continue;
    }

    line = line.replace(/(==|!=|<=|>=)/g, " $1 ");
    const parts = [];
    const regex = /"[^"]*"|\d+\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|[\[\]=,().:{}<>+\-*/]/g;
    let match;
    while ((match = regex.exec(line))) {
      parts.push(match[0]);
    }

    for (let part of parts) {
      if (part.startsWith('"') && part.endsWith('"')) {
        tokens.push({ type: "STRING", value: part.slice(1, -1), line: lineNumber });
      } else if (!isNaN(part) && /^(\d+\.\d+|\d+)$/.test(part)) {
        tokens.push({ type: "NUMBER", value: Number(part), line: lineNumber });
      } else if (["==", "!=", "<=", ">=", "[", "]", "=", ",", "(", ")", ".", "{", "}", ":", ";", "<", ">", "+", "-", "*", "/"].includes(part)) {
        tokens.push({ type: "SYMBOL", value: part, line: lineNumber });
      } else {
        tokens.push({ type: "IDENT", value: part, line: lineNumber });
      }
    }

    tokens.push({ type: "EOL", line: lineNumber });
    lineNumber++;
  }

  return tokens;
}