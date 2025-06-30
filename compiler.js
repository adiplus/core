import fs from "fs";
import { tokenize } from "./core/lexer.js";
import { parse } from "./core/parser.js";

export function compileToJS(ast, functions = {}) {
  let output = "";

  // compile custom functions
  for (const [name, def] of Object.entries(functions)) {
    output += `function ${name}(${def.params.map(p => p.name).join(", ")}) {\n`;
    output += compileToJS(def.body);
    output += `}\n\n`;
  }

  for (const node of ast) {
    switch (node.type) {
      case "VarDecl":
        output += `${node.kind} ${node.name} = ${JSON.stringify(node.value)};\n`;
        break;
      case "Func":
        output += `function ${node.name}(${node.params.map(p => p.name).join(", ")}) {\n`;
        output += compileToJS(node.body);
        output += `}\n`;
        break;
      case "TypeDef":
        // Types are ignored in JS output
        break;
      case "Say":
        output += `console.log(${JSON.stringify(node.value)});\n`;
        break;
      case "Add":
        output += `${node.name} += ${node.value};\n`;
        break;
      case "Show":
        output += `console.log("${node.name} =", ${node.name});\n`;
        break;
      case "Push":
        output += `${node.name}.push(${JSON.stringify(node.value)});\n`;
        break;
      case "Call":
        output += `${node.fnName}(${node.args.map(a => JSON.stringify(a)).join(", ")});\n`;
        break;
      case "Return":
        output += `return ${JSON.stringify(node.value)};\n`;
        break;
    }
  }

  return output;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("❌ Provide a .adi file to compile");
    process.exit(1);
  }
  const code = fs.readFileSync(file, "utf8");
  const tokens = tokenize(code);
  const { ast, functions } = parse(tokens);
  const compiled = compileToJS(ast, functions);
  console.log(compiled);
}