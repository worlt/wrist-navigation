// Each standalone preview carries the notices for the fonts it may embed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const noticeFiles = ['LICENSE', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md', 'DISCLAIMER.md',
  ...['BandSong', 'BandKai', 'BandRound'].map(name => 'wearable/src/common/fonts/' + name + '-OFL.txt')];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function notices() {
  const text = noticeFiles.map(file => '<details><summary>' + path.basename(file) + '</summary><pre>' +
    escape(fs.readFileSync(path.join(root, file), 'utf8')) + '</pre></details>').join('');
  return '<style>.project-notices{max-width:1400px;margin:32px auto 0;padding:18px 0;border-top:1px solid #b8c8ba;' +
    'font:13px/1.8 system-ui,sans-serif;color:#354f3d;overflow-wrap:anywhere}.project-notices p{margin:8px 0}' +
    '.project-notices a{color:inherit;text-decoration:underline}.project-notices summary{cursor:pointer;padding:4px 0}' +
    '.project-notices details{margin:8px 0;padding:0;border:0}.project-notices pre{white-space:pre-wrap;font:12px/1.7 monospace;' +
    'max-height:320px;overflow:auto;background:#fff;padding:12px}</style>' +
    '<footer class="project-notices" aria-label="演示与许可声明"><p><strong>演示与许可声明</strong></p>' +
    '<p>虚构数据，仅供界面演示；不连接手机或手环，不能用于真实导航。浏览器效果不等于真机验证，演示可能先于已发布安装包。</p>' +
    '<p><strong>真机与品牌范围：</strong>仅在小米 15 + 小米手环 9 Pro、K80 Ultra + 小米手环 10 Pro 两组组合获得用户真机测试正常反馈。其他米系手机通常预期能运行，但未经逐型号验证；其他品牌手机不一定能用，不保证可用。可能受运动健康互联、通知样式或后台策略影响。 不代表全部功能、所有固件或每次新版均已实测；手机模拟不是真机截图。</p>' +
    '<p><strong>退出联动限制：</strong>开启“退出手机应用时退出手环”后，直接杀掉或清理手机后台时，进程可能来不及向手环发送退出通知，因此手环无法跟随退出；从手机主页面正常按返回键或返回手势退出，有用户正常反馈。只关闭设置弹层不触发手环退出。强停、断连、系统回收同样不保证退出。</p>' +
    '<p>预览设置保存在当前浏览器。访问线上站点会连接 Vercel；托管方可能处理 IP、浏览器信息和请求日志，详见下方隐私说明。</p>' +
    '<p>本项目基于 <a href="https://github.com/Gu-Mie/wrist-navigation">Gu-Mie/wrist-navigation</a> 修改，' +
    '由 <a href="https://github.com/worlt/wrist-navigation">worlt 维护此 fork</a>。与高德、小米、AstroBox 无隶属关系，Vercel 提供托管，不表示上述品牌背书。</p>' +
    '<p>代码与文档采用 MIT；内置字体为站酷小薇体、霞鹜文楷轻便版、站酷庆科黄油体的改名子集，字体保留 OFL 1.1，真机加载效果待验证。</p>' +
    '<details><summary>版权、字体完整许可与隐私说明</summary>' + text + '</details></footer>';
}

module.exports = { notices, noticeFiles };
