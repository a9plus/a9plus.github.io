/* Kairo# - Docs at the bottom */

(function(global){

/* =========================
   TOKENIZER
========================= */
function tokenize(input){
  const tokens = [];
  const regex = /\s+|PROGRAM|ASYNC|LET|SET|IF|THEN|ELSE|END|WHILE|DO|FOR|FROM|TO|RETURN|CALL|AWAIT|COLOR|RECT[A-Za-z_][A-Za-z0-9_]*|"(?:\\.|[^"])*"|\d+|==|!=|<=|>=|[=()+\-*/.,#]/g;

  let match;
  while((match = regex.exec(input))){
    const value = match[0];
    if(!value.trim()) continue;
    tokens.push(value);
  }
  return tokens;
}

/* =========================
   PARSER
========================= */
function Parser(tokens){
  this.tokens = tokens;
  this.pos = 0;

  this.peek = () => this.tokens[this.pos];
  this.next = () => this.tokens[this.pos++];
  this.expect = (t) => {
    if(this.peek() !== t) throw "Expected " + t + " got " + this.peek();
    return this.next();
  };

  this.parseProgram = () => {
    const programs = [];
    while(this.pos < this.tokens.length){
      programs.push(this.parseFunction());
    }
    return { type:"Program", body: programs };
  };

  this.parseFunction = () => {
    this.expect("PROGRAM");

    let async = false;
    if(this.peek() === "ASYNC"){
      this.next();
      async = true;
    }

    const name = this.next();
    this.expect("(");

    const args = [];
    while(this.peek() !== ")"){
      args.push(this.next());
      if(this.peek() === ",") this.next();
    }
    this.expect(")");

    this.expect("=");

    const body = this.parseBlock();

    return {
      type:"Function",
      name, args, async, body
    };
  };

  this.parseBlock = () => {
    const body = [];
    while(this.peek() !== "END"){
      body.push(this.parseStatement());
    }
    this.expect("END");
    return body;
  };

  this.parseStatement = () => {
    const t = this.peek();

    if(t === "LET" || t === "SET"){
      this.next();
      const name = this.next();
      this.expect("=");
      return { type:"Assign", name, expr:this.parseExpr() };
    }

    if(t === "IF"){
      this.next();
      const cond = this.parseExpr();
      this.expect("THEN");
      const then = [];
      while(this.peek() !== "ELSE" && this.peek() !== "END"){
        then.push(this.parseStatement());
      }

      let otherwise = [];
      if(this.peek() === "ELSE"){
        this.next();
        while(this.peek() !== "END"){
          otherwise.push(this.parseStatement());
        }
      }

      this.expect("END");
      return { type:"If", cond, then, otherwise };
    }

    if(t === "WHILE"){
      this.next();
      const cond = this.parseExpr();
      this.expect("DO");
      const body = [];
      while(this.peek() !== "END"){
        body.push(this.parseStatement());
      }
      this.expect("END");
      return { type:"While", cond, body };
    }

    if(t === "FOR"){
      this.next();
      const v = this.next();
      this.expect("FROM");
      const start = this.parseExpr();
      this.expect("TO");
      const end = this.parseExpr();
      this.expect("DO");

      const body = [];
      while(this.peek() !== "END"){
        body.push(this.parseStatement());
      }
      this.expect("END");

      return { type:"For", v, start, end, body };
    }

    if(t === "RETURN"){
      this.next();
      return { type:"Return", expr:this.parseExpr() };
    }

    if(t === "CALL"){
      this.next();
      return { type:"Call", expr:this.parseExpr() };
    }

    if(t === "AWAIT"){
      this.next();
      return { type:"Await", expr:this.parseExpr() };
    }

    throw "Unknown statement: " + t;
  };

  this.parseExpr = () => {
    let expr = this.next();

    if(this.peek() === "("){
      this.next();
      const args = [];
      while(this.peek() !== ")"){
        args.push(this.parseExpr());
        if(this.peek() === ",") this.next();
      }
      this.expect(")");
      return { type:"CallExpr", name:expr, args };
    }

    return { type:"Literal", value:expr };
  };
}

/* =========================
   GENERATOR
========================= */
function generate(ast){

  function genExpr(e){
    if(e.type === "Literal") return e.value;
    if(e.type === "CallExpr"){
      return e.name + "(" + e.args.map(genExpr).join(",") + ")";
    }
  }

  function genStmt(s){
    switch(s.type){
      case "Assign":
        return s.name + " = " + genExpr(s.expr) + ";";

      case "Return":
        return "return " + genExpr(s.expr) + ";";

      case "Call":
        return genExpr(s.expr) + ";";

      case "Await":
        return "await " + genExpr(s.expr) + ";";

      case "If":
        return `if(${genExpr(s.cond)}){${s.then.map(genStmt).join("")}}${
          s.otherwise.length ? "else{"+s.otherwise.map(genStmt).join("")+"}" : ""
        }`;

      case "While":
        return `while(${genExpr(s.cond)}){${s.body.map(genStmt).join("")}}`;

      case "For":
        return `for(let ${s.v}=${genExpr(s.start)};${s.v}<=${genExpr(s.end)};${s.v}++){${s.body.map(genStmt).join("")}}`;
    }
  }

  return ast.body.map(fn => {
    return `
${fn.async ? "async" : ""} function ${fn.name}(${fn.args.join(",")}){
${fn.body.map(genStmt).join("\n")}
}
`;
  }).join("\n");
}

/* =========================
   RUNTIME HELPERS
========================= */

function QUERY(path){
  return resolvePath(path);
}

function QUERY_ALL(path){
  return document.querySelectorAll(path);
}

function CREATE(tag, props={}){
  const el = document.createElement(tag);
  Object.assign(el, props);
  return el;
}

function ADD(child, parent){
  parent.appendChild(child);
}

function REMOVE(node){
  node.remove();
}

function ON(node, ev, fn){
  node.addEventListener(ev, fn);
}

function SHOW(v){
  console.log(v);
}

function FETCH(url, opt){
  return fetch(url, opt).then(r=>r.json());
}

function WAIT(ms){
  return new Promise(r=>setTimeout(r, ms));
}

function STORE(k,v){
  localStorage.setItem(k, JSON.stringify(v));
}

function LOAD(k){
  return JSON.parse(localStorage.getItem(k));
}

function TIMER(ms, fn){
  return setTimeout(fn, ms);
}

function REPEAT(ms, fn){
  return setInterval(fn, ms);
}

function COLOR(ctx, c){
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
}

function RECT(ctx, x, y, w, h){
  ctx.fillRect(x,y,w,h);
}

/* =========================
   PATH RESOLVER
========================= */
function resolvePath(path){
  if(typeof path !== "string") return path;

  path = path.replace("document.html", "document.documentElement");

  const parts = path.split(".");
  let obj = window;

  for(let p of parts){
    if(p.startsWith("#")){
      obj = obj.querySelector(p);
    } else {
      obj = obj[p];
    }
  }

  return obj;
}

/* =========================
   CANVAS WRAPPER
========================= */
function CANVAS(node){
  const ctx = node.getContext("2d");

  return {
    color(c){ ctx.fillStyle = c; ctx.strokeStyle = c; },
    rect(x,y,w,h){ ctx.fillRect(x,y,w,h); },
    circle(x,y,r){
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    },
    line(x1,y1,x2,y2){
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    },
    clear(){
      ctx.clearRect(0,0,node.width,node.height);
    }
  };
}

/* =========================
   MAIN COMPILER
========================= */
function compile(code){
  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  const js = generate(ast);

  return js;
}

function run(code){
  const js = compile(code);
  return eval(js);
}

/* =========================
   EXPORT
========================= */
global.Kairo = {
  compile,
  run,
  QUERY,
  QUERY_ALL,
  CREATE,
  ADD,
  REMOVE,
  ON,
  SHOW,
  FETCH,
  WAIT,
  STORE,
  LOAD,
  TIMER,
  REPEAT,
  CANVAS
};

})(window);


/* =========================
   DOCUMENTATION
=========================

Kairo# Language Overview

PROGRAM name(args) = defines function
PROGRAM ASYNC name(args) = async function

Statements:
LET x = value
SET x = value
IF cond THEN ... ELSE ... END
WHILE cond DO ... END
FOR i FROM a TO b DO ... END
RETURN value
CALL fn(args)
AWAIT expr

Helpers:
QUERY(path)
QUERY_ALL(path)
CREATE(tag, props)
ADD(child, parent)
REMOVE(node)
ON(node, event, fn)
SHOW(value)
FETCH(url, options)
WAIT(ms)
STORE(key, value)
LOAD(key)
TIMER(ms, fn)
REPEAT(ms, fn)

Canvas:
SET gfx = CANVAS(node)
CALL gfx.color("#fff")
CALL gfx.rect(...)
CALL gfx.circle(...)
CALL gfx.line(...)
CALL gfx.clear()

Usage:
const js = Kairo.compile(code)
Kairo.run(code)

*/