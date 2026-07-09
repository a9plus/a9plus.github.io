/*!
 * LuaSharp (LS.js) - Full Single-File Procedural Lua-inspired Browser Scripting
 * Includes: Parser, Tokenizer, AST, Generator, DOM, Canvas, Animation, WebSocket
 * Author: LuaSharp Devs (Anonymous, A9)
 *(c) copyright 2026 LuaSharp team
 */

(function(global){

// --------------------------
// Tokenizer
// --------------------------
function tokenize(input){
    let i=0, tokens=[];
    const isAlpha = c => /[a-zA-Z_]/.test(c);
    const isNum = c => /[0-9]/.test(c);

    while(i<input.length){
        let c=input[i];
        if(/\s/.test(c)){ i++; continue; }

        // Raw JS
        if(input.slice(i,3)==='@js'){
            i+=3; while(/\s/.test(input[i])) i++;
            if(input[i]!=='{') throw "Expected { after @js";
            i++;
            let depth=1,start=i;
            while(depth>0 && i<input.length){
                if(input[i]==='{') depth++;
                if(input[i]==='}') depth--;
                i++;
            }
            tokens.push({type:"RAW_JS", value:input.slice(start,i-1)});
            continue;
        }

        // Numbers
        if(isNum(c)){
            let start=i;
            while(isNum(input[i])) i++;
            tokens.push({type:"NUMBER", value:Number(input.slice(start,i))});
            continue;
        }

        // Identifiers
        if(isAlpha(c)){
            let start=i;
            while(isAlpha(input[i]) || isNum(input[i])) i++;
            tokens.push({type:"IDENT", value:input.slice(start,i)});
            continue;
        }

        // Strings
        if(c==='\"'||c==='\''){
            let q=c; i++;
            let start=i;
            while(input[i]!==q && i<input.length) i++;
            tokens.push({type:"STRING", value:input.slice(start,i)});
            i++; continue;
        }

        // Symbols
        const symbols={'#':'HASH','.':'.','(':'(','[':'[',']':']','{':'{','}':'}',',':',','=':'='};
        if(symbols[c]){ tokens.push({type:symbols[c]}); i++; continue; }

        throw `Unknown token: ${c}`;
    }
    return tokens;
}

// --------------------------
// Parser
// --------------------------
function parse(tokens){
    let i=0;
    const peek = ()=>tokens[i];
    const next = ()=>tokens[i++];
    const expect = t=>{ if(peek().type!==t) throw `Expected ${t}`; return next(); };

    function parseProgram(){
        let body=[];
        while(i<tokens.length) body.push(parseStatement());
        return {type:"Program", body};
    }

    function parseStatement(){
        let t=peek();
        if(t.type==="IDENT" && t.value==="local") return parseVar();
        if(t.type==="IDENT" && t.value==="function") return parseFunction();
        if(t.type==="IDENT" && t.value==="if") return parseIf();
        if(t.type==="IDENT" && t.value==="while") return parseWhile();
        if(t.type==="IDENT" && t.value==="for") return parseFor();
        if(t.type==="RAW_JS") return {type:"RawJS", code: next().value};
        return parseExpression();
    }

    function parseVar(){ next(); let name=expect("IDENT").value; expect("="); let value=parseExpression(); return {type:"VarDecl", name, value}; }
    function parseFunction(){
        next(); let name=expect("IDENT").value; expect("(");
        let params=[];
        while(peek().type!==")"){ params.push(expect("IDENT").value); if(peek().type===",") next(); }
        expect(")"); let body=[];
        while(!(peek().type==="IDENT" && peek().value==="end")) body.push(parseStatement());
        next(); return {type:"FunctionDecl", name, params, body};
    }
    function parseIf(){ next(); let cond=parseExpression(); expect("IDENT"); let body=[]; while(!(peek().value==="end")) body.push(parseStatement()); next(); return {type:"IfStmt", cond, body}; }
    function parseWhile(){ next(); let cond=parseExpression(); expect("IDENT"); let body=[]; while(!(peek().value==="IDENT" && peek().value==="end")) body.push(parseStatement()); next(); return {type:"WhileStmt", cond, body}; }
    function parseFor(){ next(); let name=expect("IDENT").value; expect("="); let start=parseExpression(); expect(","); let end=parseExpression(); expect("IDENT"); let body=[]; while(!(peek().value==="end")) body.push(parseStatement()); next(); return {type:"ForStmt", name, start, end, body}; }

    function parseExpression(){ return parseMember(); }
    function parseMember(){
        let obj=parsePrimary();
        while(true){
            if(peek() && peek().type==="."){ next(); let prop=expect("IDENT").value; obj={type:"Member", object:obj, property:prop}; }
            else if(peek() && peek().type==="HASH"){ next(); let name=expect("IDENT").value; obj={type:"DomHash", object:obj, name}; }
            else if(peek() && peek().type==="["){ next(); let idx=parseExpression(); expect("]"); obj={type:"Index", object:obj, index:idx}; }
            else break;
        }
        return obj;
    }
    function parsePrimary(){
        let t=next();
        if(t.type==="NUMBER"||t.type==="STRING") return t;
        if(t.type==="IDENT") return {type:"Identifier", name:t.value};
        if(t.type==="{"){
            let props=[];
            while(peek().type!=="}"){ let key=expect("IDENT").value; expect("="); let val=parseExpression(); props.push({key,val}); if(peek().type===",") next(); }
            next();
            return {type:"Table", props};
        }
        throw "Unexpected token in primary";
    }

    return parseProgram();
}

// --------------------------
// Generator
// --------------------------
function generate(node){
    switch(node.type){
        case "Program": return node.body.map(generate).join("\n");
        case "VarDecl": return `let ${node.name}=${generate(node.value)};`;
        case "FunctionDecl": return `function ${node.name}(${node.params.join(",")}){\n${node.body.map(generate).join("\n")}\n}`;
        case "IfStmt": return `if(${generate(node.cond)}){\n${node.body.map(generate).join("\n")}\n}`;
        case "WhileStmt": return `while(${generate(node.cond)}){\n${node.body.map(generate).join("\n")}\n}`;
        case "ForStmt": return `for(let ${node.name}=${generate(node.start)};${node.name}<=${generate(node.end)};${node.name}++){\n${node.body.map(generate).join("\n")}\n}`;
        case "Member": return `${generate(node.object)}.${node.property}`;
        case "DomHash": return `__dom_hash(${generate(node.object)},"${node.name}")`;
        case "Index": return `${generate(node.object)}[${generate(node.index)}-1]`;
        case "Table": return `{${node.props.map(p=>`${p.key}:${generate(p.val)}`).join(",")}}`;
        case "Identifier": return node.name;
        case "NUMBER": return node.value;
        case "STRING": return `"${node.value}"`;
        case "RawJS": return node.code;
        default: throw "Unknown AST node type: "+node.type;
    }
}

// --------------------------
// Runtime Helpers
// --------------------------
function wrapElement(el){ if(!el) return null; return {_el:el,on:(e,f)=>el.addEventListener(e,f),append:(c)=>el.appendChild(c._el||c),setText:(t)=>el.textContent=t,setHTML:(h)=>el.innerHTML=h,css:(s)=>{for(let k in s) el.style[k]=s[k]}};}
function __dom_hash(el,name){let f=el._el.querySelector("#"+name); if(!f) f=el._el.querySelector("."+name); return wrapElement(f);}
function wrapCanvas(el){if(!el)return null; const ctx=el.getContext("2d"); return {_el:el,_ctx:ctx,clear:()=>ctx.clearRect(0,0,el.width,el.height),rect:(x,y,w,h)=>ctx.fillRect(x,y,w,h),circle:(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill()},line:(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()},color:(c)=>{ctx.fillStyle=c;ctx.strokeStyle=c}};}
const __loops=[]; function loop(cb){__loops.push(cb);} function __runLoops(){__loops.forEach(fn=>fn()); requestAnimationFrame(__runLoops);} requestAnimationFrame(__runLoops);
function createWebSocket(url){const ws=new WebSocket(url); return {send:m=>ws.send(m),on:(e,cb)=>ws.addEventListener(e,cb)};}
function createElement(tag,props){const el=document.createElement(tag); if(props){if(props.id) el.id=props.id;if(props.className) el.className=props.className;if(props.text) el.textContent=props.text;if(props.html) el.innerHTML=props.html;if(props.css) for(let k in props.css) el.style[k]=props.css[k];} return wrapElement(el);}

// --------------------------
// LuaSharp API
// --------------------------
const LuaSharp={
    compile:function(src){const t=tokenize(src); const a=parse(t); return generate(a);},
    run:function(src){const js=LuaSharp.compile(src); return (new Function("document","wrapElement","wrapCanvas","loop","createWebSocket","createElement","__dom_hash",js))(document,wrapElement,wrapCanvas,loop,createWebSocket,createElement,__dom_hash);},
    wrapElement, wrapCanvas, loop, createWebSocket, createElement
};
global.LuaSharp=LuaSharp;

})(window);