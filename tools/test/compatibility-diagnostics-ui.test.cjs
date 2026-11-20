const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..');const phone=fs.readFileSync(path.join(root,'android/app/src/main/java/io/github/mi9pro/navigation/MainActivity.java'),'utf8');
const band=fs.readFileSync(path.join(root,'wearable/src/pages/index/index.ux'),'utf8');
test('compatibility diagnostics are phone-only, explicit and privacy-safe copy is separate',()=>{assert.match(phone,/读取手环诊断/);assert.match(phone,/bridge\.requestBandDiagnostics\(\)/);assert.match(phone,/复制兼容诊断（无路线）/);assert.match(phone,/bridge\.compatibilityReport\(\)/);assert.doesNotMatch(band,/setBasicMode|sendDiagnostics|排查模式|diagnostics-query/);});
