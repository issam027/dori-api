const fs=require('fs'),path=require('path');
const base=path.resolve(__dirname,'../../..');
const result={};
for(const name of ['dori-api','dori-web','dori-agent']){
const root=path.join(base,name),ts=require(path.join(root,'node_modules/typescript'));
const cf=ts.readConfigFile(path.join(root,name==='dori-web'?'tsconfig.app.json':'tsconfig.json'),ts.sys.readFile);
const cfg=ts.parseJsonConfigFileContent(cf.config,ts.sys,root);
const p=ts.createProgram(cfg.fileNames,{...cfg.options,noEmit:true,incremental:false,noUnusedLocals:true,noUnusedParameters:true});
const checker=p.getTypeChecker();
const files=p.getSourceFiles().filter(f=>path.resolve(f.fileName).startsWith(path.join(root,'src'))&&!f.fileName.includes('generated')&&!f.isDeclarationFile);
const isTest=f=>/\.(spec|test)\.[jt]sx?$/.test(f.fileName);
const refs=new Map(),exports=[],methods=[],edges=new Map();
const normalize=s=>{try{return s&&(s.flags&ts.SymbolFlags.Alias)?checker.getAliasedSymbol(s):s}catch{return s}};
for(const f of files){
const deps=[];
function walk(n){
if(ts.isIdentifier(n)){
const s=normalize(checker.getSymbolAtLocation(n)); if(s){let a=refs.get(s);if(!a)refs.set(s,a=[]);a.push({file:f.fileName,pos:n.pos,test:isTest(f)});}
}
if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)){
const r=ts.resolveModuleName(n.moduleSpecifier.text,f.fileName,cfg.options,ts.sys).resolvedModule;if(r)deps.push(r.resolvedFileName);
}
if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){
const r=ts.resolveModuleName(n.arguments[0].text,f.fileName,cfg.options,ts.sys).resolvedModule;if(r)deps.push(r.resolvedFileName);
}
if(!isTest(f)&&n.name&&ts.isIdentifier(n.name)){
if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)||ts.isVariableStatement(n))&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))exports.push({f,n});
if(ts.isVariableDeclaration(n)&&n.parent?.parent?.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))exports.push({f,n});
if(ts.isMethodDeclaration(n)&&!ts.canHaveDecorators(n)||ts.isMethodDeclaration(n)&&!(ts.getDecorators(n)?.length)) {if(ts.isMethodDeclaration(n))methods.push({f,n});}
}
ts.forEachChild(n,walk);
}walk(f);edges.set(f.fileName,deps);
}
const rel=f=>path.relative(root,f).replaceAll('\\','/');
function candidate({f,n}){
const s=normalize(checker.getSymbolAtLocation(n.name));const r=(refs.get(s)||[]).filter(x=>!(x.file===f.fileName&&x.pos===n.name.pos));
return {file:rel(f.fileName),line:f.getLineAndCharacterOfPosition(n.name.getStart()).line+1,name:n.name.text,productionReferences:r.filter(x=>!x.test).length,testReferences:r.filter(x=>x.test).length,externalProductionReferences:r.filter(x=>!x.test&&x.file!==f.fileName).length};
}
const rootfile=files.find(f=>/[/\\]main\.tsx?$/.test(f.fileName));const seen=new Set();
function visit(f){if(seen.has(f))return;seen.add(f);for(const d of edges.get(f)||[])visit(d)}if(rootfile)visit(rootfile.fileName);
result[name]={files:files.length,unreachableFromMain:files.filter(f=>!isTest(f)&&!seen.has(f.fileName)).map(f=>rel(f.fileName)),exportsWithoutExternalProductionReference:exports.map(candidate).filter(c=>!c.externalProductionReferences),methodsWithoutProductionReference:methods.map(candidate).filter(c=>!c.productionReferences),unusedDiagnostics:ts.getPreEmitDiagnostics(p).filter(d=>[6133,6192,6196,6198].includes(d.code)).map(d=>({file:d.file?rel(d.file.fileName):'',line:d.file&&d.start!=null?d.file.getLineAndCharacterOfPosition(d.start).line+1:0,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))};
console.log(name,JSON.stringify({files:result[name].files,orphans:result[name].unreachableFromMain.length,exports:result[name].exportsWithoutExternalProductionReference.length,methods:result[name].methodsWithoutProductionReference.length,unused:result[name].unusedDiagnostics.length}));
}
result._limitations=['Inventaire de candidats, pas une liste de suppression. Les références par interface et réflexion peuvent être sous-comptées.','Le graphe exclut scripts et code généré : confronter obligatoirement les candidats aux configurations, scripts, routes et frameworks.','Les références de tests ne prouvent pas une utilisation en production.'];
fs.writeFileSync(path.join(__dirname,'code-mort-candidats-2026-11-01.json'),JSON.stringify(result,null,2));

