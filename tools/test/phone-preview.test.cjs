const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const preview=require('../phone-preview-model.cjs')();
const config={phone:{versionName:'0.4.2',versionCode:27},band:{versionName:'0.5.1',versionCode:25}};
test('offline phone simulation uses isolated settings and current source versions',()=>{
 const model=preview.create(config);assert.equal(model.phone.current,'0.4.2');assert.equal(model.band.current,'0.5.1');
 model.phone.preview=true;model.phone.auto=false;assert.equal(model.band.preview,false);assert.equal(model.band.auto,true);
 assert.equal(preview.view(model,'phone').latest,'0.4.2');assert.equal(preview.view(model,'band').latest,'0.5.1');
});
test('simulation preserves unknown, offline and same-version meanings',()=>{
 const model=preview.create(config);preview.scenario(model,'unknown');assert.equal(preview.view(model,'band').status,'手环版本未知');
 preview.scenario(model,'offline');assert.match(preview.view(model,'phone').source,/待确认/);assert.notEqual(preview.view(model,'phone').status,'当前无需更新');
 preview.scenario(model,'same');assert.equal(preview.view(model,'phone').status,'当前无需更新');
 preview.scenario(model,'update');assert.equal(preview.view(model,'phone').status,'有新版本可用');assert.match(preview.view(model,'phone').source,/虚构/);
});
test('simulated checks and disclosures are independent and channel changes invalidate late work',()=>{
 const model=preview.create(config);model.phone.expanded=true;const token=preview.begin(model,'phone');assert.equal(preview.view(model,'phone').status,'正在检查更新');
 assert.equal(preview.view(model,'band').status,'当前无需更新');preview.finish(model,'phone',token);assert.equal(model.phone.expanded,true);
 const stale=preview.begin(model,'phone');preview.channel(model,'phone',true);preview.finish(model,'phone',stale);assert.equal(model.phone.preview,true);assert.equal(model.phone.state,'complete');
});
test('bad or unavailable browser storage never breaks preview and only known settings are saved',()=>{
 for(const value of ['{bad','[]','null','"bad"']){const model=preview.create(config,{getItem:()=>value});assert.equal(model.phone.auto,true);assert.equal(model.phone.preview,false)}
 const model=preview.create(config,{getItem(){throw Error('denied')}});assert.doesNotThrow(()=>preview.save(model,{setItem(){throw Error('denied')}}));
 let text;model.phone.preview=true;preview.save(model,{setItem:(key,value)=>text=value});assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['band','phone']);
 const restored=preview.create(config,{getItem:()=>text});assert.equal(restored.phone.preview,true);assert.equal(restored.band.preview,false);
});
test('phone page is bundled offline with visible verification limits and linked by all pages',()=>{
 const root=path.resolve(__dirname,'../..');const html=fs.readFileSync(path.join(root,'outputs/previews/phone-preview.html'),'utf8');
 for(const term of ['虚构','小米 15','K80 Ultra','其他品牌','杀掉','后台','返回','Gu-Mie','MIT','OFL'])assert.ok(html.includes(term),term);
 assert.doesNotMatch(html,/\bfetch\s*\(|XMLHttpRequest|https?:\/\/[^" ]+\.js/);
 for(const file of ['site/index.html','site/preview.html','site/settings.html'])assert.match(fs.readFileSync(path.join(root,file),'utf8'),/href="phone.html"/);
 assert.match(html,/data-action="open-updates"/);assert.match(html,/aria-live="polite"/);assert.match(html,/GitHub 最新版本/);
});

test('narrow phone preview grid allows its children to shrink below the 390px mock width',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../phone-preview.html'),'utf8');
 assert.match(html,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/\.phone\{margin:auto;min-width:0\}/);
});

test('fictional update versions advance from current sources, never reuse the installed version label',()=>{
 const model=preview.create({phone:{versionName:'0.4.3',versionCode:28},band:{versionName:'0.5.2',versionCode:26}});
 preview.scenario(model,'update');assert.equal(preview.view(model,'phone').latest,'0.4.4');assert.equal(preview.view(model,'band').latest,'0.5.3');
});

test('phone bridge emits and ACK-clears explicit bounded link reminders independently of navigation',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../android/app/src/main/java/io/github/mi9pro/navigation/WearBridge.java'),'utf8');
 assert.match(source,/appLink\.openId/);assert.match(source,/packet\.put\("phoneOpenId", phoneOpenId\)/);assert.match(source,/appLink\.ackOpen/);
});
