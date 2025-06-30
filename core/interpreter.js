import fetch from "node-fetch";
import process from "process";

export async function interpret(ast, userFuncs = {}, externalFns = {}) {
  const context = {};
  let returnFlag = false;
  let returnValue;

  const builtins = {
    delay: ms => new Promise(res => setTimeout(res, Number(ms))),
    fetch: async url => (await fetch(url)).text(),
    sys_args: () => process.argv.slice(3),
    sys_env: () => process.env
  };

  const allFns = { ...builtins, ...externalFns };

  async function evalExpr(expr, ctx) {
    if (!expr) return undefined;
    switch (expr.type) {
      case "Literal":
        return expr.value;
      case "Identifier":
        if (ctx[expr.name] !== undefined) return ctx[expr.name];
        if (context[expr.name] !== undefined) return context[expr.name];
        return undefined;
      case "BinaryExpr": {
        const left = await evalExpr(expr.left, ctx);
        const right = await evalExpr(expr.right, ctx);
        switch (expr.op) {
          case "+": return left + right;
          case "-": return left - right;
          case "*": return left * right;
          case "/": return left / right;
          case "==": return left == right;
          case "!=": return left != right;
          case "<": return left < right;
          case ">": return left > right;
          case "<=": return left <= right;
          case ">=": return left >= right;
        }
        break;
      }
      case "CallExpr": {
        let fn = allFns[expr.name] || userFuncs[expr.name];
        if (!fn) throw new Error(`Function '${expr.name}' not found`);
        const args = await Promise.all(expr.args.map(arg => evalExpr(arg, ctx)));
        if (typeof fn === "function") {
          return await fn(...args);
        } else if (fn.body) {
          const fnCtx = { ...ctx };
          fn.params.forEach((param, i) => {
            fnCtx[param.name] = args[i];
          });
          let result;
          let prevReturnFlag = returnFlag;
          returnFlag = false;
          await runBlock(fn.body, fnCtx);
          result = returnValue;
          returnFlag = prevReturnFlag;
          return result;
        }
        break;
      }
      case "ArrayLiteral":
        return await Promise.all(expr.elements.map(e => evalExpr(e, ctx)));
      case "ObjectLiteral": {
        const obj = {};
        for (const { key, value } of expr.fields) {
          obj[key] = await evalExpr(value, ctx);
        }
        return obj;
      }
      default:
        return expr;
    }
  }

  async function runBlock(block, ctx = {}) {
    for (const node of block) {
      try {
        if (returnFlag) break;
        switch (node.type) {
          case "VarDecl":
            ctx[node.name] = await evalExpr(node.value, ctx);
            break;
          case "Func":
          case "ExportFunc":
            userFuncs[node.name] = node;
            break;
          case "TypeDef":
            break;
          case "Say":
            console.log(await evalExpr(node.value, ctx));
            break;
          case "Add":
            ctx[node.name] += await evalExpr(node.value, ctx);
            break;
          case "Push":
            if (!Array.isArray(ctx[node.name])) ctx[node.name] = [];
            ctx[node.name].push(await evalExpr(node.value, ctx));
            break;
          case "Show":
            console.log(`${node.name} =`, ctx[node.name]);
            break;
          case "If": {
            const cond = await evalExpr(node.condition, ctx);
            if (cond) {
              // Always run as block
              await runBlock(Array.isArray(node.body) ? node.body : [node.body], ctx);
            } else if (node.alternate) {
              await runBlock(Array.isArray(node.alternate) ? node.alternate : [node.alternate], ctx);
            }
            break;
          }
          case "While": {
            while (await evalExpr(node.condition, ctx)) {
              await runBlock(node.body, ctx);
              if (returnFlag) break;
            }
            break;
          }
          case "Foreach": {
            const arr = ctx[node.arr];
            if (!Array.isArray(arr)) break;
            for (const item of arr) {
              const loopCtx = { ...ctx, [node.iter]: item };
              await runBlock(node.body, loopCtx);
              if (returnFlag) break;
            }
            break;
          }
          case "For": {
            ctx[node.initVar] = Number(node.initVal);
            while (true) {
              const condLeft = ctx[node.condVar];
              const condRight = Number(node.condVal);
              let cond = false;
              switch (node.condOp) {
                case "<": cond = condLeft < condRight; break;
                case ">": cond = condLeft > condRight; break;
                case "<=": cond = condLeft <= condRight; break;
                case ">=": cond = condLeft >= condRight; break;
                case "==": cond = condLeft == condRight; break;
                case "!=": cond = condLeft != condRight; break;
              }
              if (!cond) break;
              await runBlock(node.body, ctx);
              ctx[node.stepVar] = ctx[node.stepVar] + Number(node.stepVal);
              if (returnFlag) break;
            }
            break;
          }
          case "Call": {
  let fn = externalFns[node.fnName];
  if (fn) {
    const result = await fn(...(await Promise.all(node.args.map(arg => evalExpr(arg, ctx)))));
    if (result !== undefined) console.log(result);
  } else if (userFuncs[node.fnName]) {
    const fnDef = userFuncs[node.fnName];
    const fnCtx = { ...ctx };
    for (let index = 0; index < fnDef.params.length; index++) {
      const param = fnDef.params[index];
      fnCtx[param.name] = await evalExpr(node.args[index], ctx);
    }
    await runBlock(fnDef.body, fnCtx);
  } else {
    console.error(`❌ Function '${node.fnName}' not found, (line ${node.line}): ${err.message}`);
  }
  break;
}
          case "CallExpr": {
            // Top-level function call as a statement
            let fn = allFns[node.name] || userFuncs[node.name];
            if (!fn) {
              console.error(`❌ Function '${node.name}' not found`);
              break;
            }
            const args = await Promise.all(node.args.map(arg => evalExpr(arg, ctx)));
            if (typeof fn === "function") {
              await fn(...args);
            } else if (fn.body) {
              const fnCtx = { ...ctx };
              fn.params.forEach((param, i) => {
                fnCtx[param.name] = args[i];
              });
              await runBlock(fn.body, fnCtx);
            }
            break;
          }
          case "Return":
            returnValue = await evalExpr(node.value, ctx);
            returnFlag = true;
            break;
          case "Debug":
            console.log("🧠 Context:", ctx);
            break;
          default:
            console.error(`❌ Unknown node type '${node.type} (line ${node.line}): ${err.message}'`);
            break;
        }
if (node.type === "Test") {
  try {
    await runBlock(node.body, ctx);
    console.log(`✅ Test '${node.name}' passed`);
  } catch (err) {
    console.error(`❌ Test '${node.name}' failed:`, err.message);
  }
  continue;
}
      } catch (err) {
        console.error(`❌ Error in node type ${node.type} (line ${node.line}): ${err.message}`);
      }
    }
  }

  returnFlag = false;
  await runBlock(ast, context);
}