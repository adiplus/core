import fs from "fs";
import { interpret } from "./core/interpreter.js";
import { tokenize } from "./core/lexer.js";
import { parse } from "./core/parser.js";
import { functions as baseFns } from "./core/functions.js";

export async function runFile(file) {
  const code = fs.readFileSync(file, "utf8");
  const { ast, functions: userFuncs = {}, imports = [] } = parse(tokenize(code));

  const importedFns = {};

  for (const { pkg, alias } of imports || []) {
    const pkgPath = `./packages/${pkg}`;
    const jsFile = `${pkgPath}/index.js`;
    const adiFile = `${pkgPath}/index.adi`;

    if (fs.existsSync(jsFile)) {
      const mod = await import(jsFile);
      for (const [key, val] of Object.entries(mod)) {
        const fnName = alias ? `${alias}.${key}` : `${pkg}.${key}`;
        importedFns[fnName] = val;
      }
    } else if (fs.existsSync(adiFile)) {
      const adiCode = fs.readFileSync(adiFile, "utf8");
      const { functions: modFuncs = {} } = parse(tokenize(adiCode));
      for (const [fnName, def] of Object.entries(modFuncs)) {
        const scopedName = alias ? `${alias}.${fnName}` : `${pkg}.${fnName}`;
        userFuncs[scopedName] = def;
      }
    } else {
      console.warn(`⚠️ Package '${pkg}' not found.`);
    }
  }

  const allFns = { ...baseFns, ...importedFns };
  await interpret(ast, userFuncs, allFns);
}

import readline from "readline";

async function startRepl() {
  const context = {};
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "adi> "
  });

  rl.prompt();
  rl.on("line", async (line) => {
    try {
      const { ast } = parse(tokenize(line));
      await interpret(ast, {}, {});
    } catch (err) {
      console.error("❌", err.message);
    }
    rl.prompt();
  });
}

const cmd = process.argv[2];
const file = process.argv[3];

if (cmd === "run" && file) {
  runFile(file);
} else if (cmd === "repl") {
  startRepl();
}