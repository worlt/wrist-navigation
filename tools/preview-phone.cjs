// Generate a standalone phone UI simulation without build/runtime dependencies.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const {notices}=require('./preview-notices.cjs');
function renderPhone() {
const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8');const band=JSON.parse(fs.readFileSync(path.join(root,'wearable/src/manifest.json'),'utf8'));
const config={phone:{versionName:/versionName\s+'([^']+)'/.exec(gradle)[1],versionCode:Number(/versionCode\s+(\d+)/.exec(gradle)[1])},band:{versionName:band.versionName,versionCode:band.versionCode}};
let html=fs.readFileSync(path.join(__dirname,'phone-preview.html'),'utf8');
html=html.replaceAll('__PHONE_VERSION__',config.phone.versionName).replaceAll('__BAND_VERSION__',config.band.versionName)
 .replace('<!-- SIMULATION -->','<script>const phoneConfig='+JSON.stringify(config)+';const phonePreviewModel='+require('./phone-preview-model.cjs').toString()+';\n'+fs.readFileSync(path.join(__dirname,'phone-preview-runtime.js'),'utf8')+'</script>')
 .replace('<!-- NOTICES -->',notices());
return html;
}
if (require.main === module) {
const html=renderPhone();
const output=path.join(root,'outputs/previews');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'phone-preview.html'),html);console.log('手机模拟页 '+path.join(output,'phone-preview.html'));

}
module.exports={renderPhone};
