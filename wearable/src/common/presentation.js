const geometry = require('./geometry')
const artwork = require('./arrow-artwork.json')

// Fixed-height list rows must each fit one line on the 336px band display.
// Use a conservative full-width character budget, preserving surrogate pairs.
function lines(text, budget) {
  const limit = typeof budget === 'number' && isFinite(budget) && budget > 0 ? Math.max(1, Math.floor(budget)) : 14;
  const result = [];
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  for (let p = 0; p < paragraphs.length; p++) {
    let row = '';
    let count = 0;
    for (let i = 0; i < paragraphs[p].length; i++) {
      const code = paragraphs[p].charCodeAt(i);
      row += paragraphs[p][i];
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < paragraphs[p].length) {
        const next = paragraphs[p].charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) row += paragraphs[p][++i];
      }
      if (++count === limit) { result.push(row); row = ''; count = 0; }
    }
    if (row || !paragraphs[p]) result.push(row || ' ');
  }
  return result;
}

// One table drives every waiting and error screen, so a new device state keeps
// the same voice as its title. Two short lines are read faster than a sentence.
const STATUS_HINTS = {
  '等待连接': ['请在手机上连接', '小米运动健康'],
  '已连接': ['连接已就绪', '在高德开始导航'],
  '等待导航': ['在高德开始导航', '指引将在这里显示'],
  '手机端未就绪': ['请打开手机的', '腕上导航'],
  '手机端未安装': ['请安装手机端', '腕上导航'],
  '导航结束': ['下一次出发时', '自动同步导航'],
  '同步已暂停': ['请在手机端', '开启导航同步'],
  '导航已过期': ['等待手机更新导航', '或查看手机'],
  '连接已断开': ['请在手机上', '重新连接手环'],
  '连接不可用': ['请在手机上', '重新连接手环'],
  '通知读取不可用': ['请检查手机的', '通知使用权']
};

// Nothing has arrived from the phone yet: name the specific link that is missing
// instead of showing one generic waiting hint for every failure.
function waitingStatus(connected, apkStatus) {
  if (!connected) return '等待连接';
  if (apkStatus === 'CONNECTED') return '已连接';
  if (apkStatus === 'DISCONNECTED') return '手机端未就绪';
  if (apkStatus === 'UNINSTALLED') return '手机端未安装';
  return '等待导航';
}

function statusHints(status) {
  return (STATUS_HINTS[status] || []).slice();
}

function errorText(stage, data, code) {
  const errorCode = code !== undefined ? code : data && data.code;
  const detail = typeof data === 'string' ? data : data && (data.message || data.data);
  return stage + (errorCode !== undefined && errorCode !== null ? ' (' + errorCode + ')' : '') +
    (detail ? '\n' + String(detail).slice(0, 160) : '');
}

// Remove only exact duplicate guidance and Gaode's fixed status label; keep all other text.
function details(view) {
  if (!view.live) return view.rawText === view.instruction ? '' : view.rawText;
  const compact = value => String(value || '').replace(/\s/g, '');
  const instruction = compact(view.instruction);
  const distance = compact(view.distance);
  return String(view.rawText || '').split('\n').filter(line => {
    const value = compact(line);
    return value && value !== '高德导航中' && value !== '高德地图' &&
      value !== instruction && value !== instruction + distance && value !== distance + instruction;
  }).join('\n');
}

// A display-only projection: retain the packet's wording and original unit.
function layout(view) {
  const guidance = !!view.live || view.status === '演示 · 非真实导航';
  const distance = String(view.distance || '').trim();
  const parts = distance.match(/^(\d+(?:\.\d+)?)\s*(公里|千米|米|km|m)$/i);
  const value = parts ? parts[1] : distance.length <= 6 ? distance : '';
  const size = value.length <= 3 ? 72 : value.length <= 5 ? 52 : value.length <= 8 ? 32 : 24;
  let extra = details(view);
  // Long/unrecognised fields remain readable in the scrollable text area.
  const overflow = [];
  if (guidance && distance.length > 6 && !parts) overflow.push(distance);
  if (guidance && String(view.instruction || '').length > 16) overflow.push(view.instruction);
  for (const field of overflow) {
    if (extra.indexOf(field) < 0) extra = field + (extra ? '\n' + extra : '');
  }
  return {
    guidance, header: guidance ? view.status : '腕上导航',
    statusColor: view.live || view.status === '已连接' ? '#80f5be'
      : /过期|断开|不可用|演示|未就绪|未安装/.test(view.status) ? '#d4b57b' : '#64776b',
    distanceValue: guidance ? value || '—' : '',
    distanceUnit: guidance ? parts ? parts[2] : distance && !value ? '查看原文' : '' : '',
    distanceSize: size, hint: statusHints(view.status).join(' '), details: extra
  };
}

// Preserve the notification's wording, including unrecognized directions and roads.
// Only remove the exact fixed app/status labels; never reconstruct a sentence.
function navigationText(view) {
  const raw = String(view.rawText || '').trim();
  if (!raw) return String(view.instruction || '').trim() || String(view.distance || '').trim();
  const content = raw.split(/\r?\n/).filter(line => {
    const label = line.trim();
    return label !== '高德地图' && label !== '高德导航中';
  }).join('\n').trim();
  return content || raw;
}

// An exit ordinal is not a bearing. Read only explicit ordinals for the current
// roundabout maneuver; keep the notification verbatim and never infer an angle.
function roundaboutExit(view) {
  if (view.icon !== 'roundabout') return '';
  const text = [view.rawText || '', view.instruction || ''].join('\n')
    .replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  const exits = /第\s*([0-9零〇一二两三四五六七八九十百点.]+)\s*(?:个\s*)?出口/g;
  const digits = '零一二三四五六七八九';
  let result = '';
  let match;
  while ((match = exits.exec(text))) {
    // "从第3出口进入环岛" describes an entrance, not the upcoming exit.
    if (/^[ \t，,]*(?:进入|驶入)环岛/.test(text.slice(exits.lastIndex))) continue;
    const token = match[1];
    let number;
    if (/^[1-9]\d?$/.test(token)) number = Number(token);
    else if (/^[一二三四五六七八九]$/.test(token)) number = digits.indexOf(token);
    else if (/^(?:[一二三四五六七八九])?十[一二三四五六七八九]?$/.test(token)) {
      const parts = token.split('十');
      number = (parts[0] ? digits.indexOf(parts[0]) : 1) * 10 + (parts[1] ? digits.indexOf(parts[1]) : 0);
    } else return '';
    if (result && result !== String(number)) return '';
    result = String(number);
  }
  return result;
}

function navigationLayout(view, settings, warning) {
  const size = settings.fontSize;
  const rowHeight = Math.ceil(size * 1.4);
  let text = navigationText(view);
  if (warning) text += (text ? '\n' : '') + warning;
  const rows = lines(text, Math.floor(geometry.CONTENT_WIDTH / size));
  const stageHeight = view.demo
    ? geometry.NAVIGATION_BOTTOM - geometry.NAVIGATION_DEMO_TOP : geometry.NAVIGATION_HEIGHT;
  // Vertical space comes from the panel's safe area, not the text column width.
  // Reserve two complete rows before allocating space to the arrow.
  const textHeight = rows.length * rowHeight;
  const reserved = Math.min(textHeight, geometry.GUIDANCE_MAX, rowHeight * 2);
  const arrowSize = Math.min(settings.arrowSize,
    Math.max(geometry.MIN_ARROW_SIZE, stageHeight - geometry.ARROW_GAP - reserved));
  const fitHeight = Math.min(geometry.GUIDANCE_MAX,
    stageHeight - arrowSize - geometry.ARROW_GAP, textHeight);
  // End on a row boundary: a half-chopped line reads as a rendering fault.
  const guidanceHeight = textHeight > fitHeight
    ? Math.max(rowHeight, Math.floor(fitHeight / rowHeight) * rowHeight) : fitHeight;
  const contentHeight = arrowSize + geometry.ARROW_GAP + guidanceHeight;
  const exit = roundaboutExit(view);
  const frame = artwork.frames.roundabout;
  const ring = artwork.roundabout;
  const scale = arrowSize / frame[2];
  const exitNumberWidth = ring.labelSize * scale;
  const exitNumberHeight = exitNumberWidth;
  return { arrowDrawSize: arrowSize, guidanceLines: rows, rowHeight, guidanceHeight, contentHeight,
    contentTop: geometry.navigationTop(contentHeight),
    arrowLeft: geometry.centerInContent(arrowSize),
    roundaboutExit: exit, exitNumberWidth, exitNumberHeight,
    exitNumberLeft: geometry.centerInContent(arrowSize) + (ring.centerX - frame[0] - ring.labelSize / 2) * scale,
    exitNumberTop: (ring.centerY - frame[1] - ring.labelSize / 2) * scale,
    exitNumberFontSize: (exit.length > 1 ? ring.doubleFontSize : ring.fontSize) * scale,
    guidanceTop: arrowSize + geometry.ARROW_GAP };
}

// All three screens share one type scale. Bigger settings scroll instead of
// squeezing controls or silently ignoring the user's chosen font size.
function typography(fontSize) {
  const labelSize = Math.round(fontSize * 0.8);
  const hintSize = Math.round(fontSize * 0.72);
  const auxiliarySize = Math.round(fontSize * 0.6);
  const titleHeight = Math.ceil(fontSize * 1.4);
  const labelHeight = Math.ceil(labelSize * 1.16);
  const hintHeight = Math.ceil(hintSize * 1.4);
  const auxiliaryHeight = Math.ceil(auxiliarySize * 1.25);
  const buttonHeight = Math.max(52, titleHeight);
  const fontSelectorHeight = Math.max(44, labelHeight + 12);
  return { labelSize, hintSize, auxiliarySize, titleHeight, labelHeight, hintHeight, auxiliaryHeight,
    buttonHeight, controlTop: labelHeight + 4, settingRowHeight: labelHeight + 4 + buttonHeight + 12,
    fontSelectorHeight, fontRowHeight: fontSelectorHeight + 12,
    footerHeight: auxiliaryHeight * 2 + 4, adjustSize: Math.round(fontSize * 1.15),
    fontChoiceHeight: labelHeight + titleHeight + 16 };
}

function restLayout(view, warning, settings) {
  const type = typography(settings ? settings.fontSize : 30);
  const hintLines = statusHints(view.status).reduce((all, text) => all.concat(lines(text, Math.floor(geometry.CONTENT_WIDTH / type.hintSize))), []);
  const titleLines = lines(view.status, Math.floor(geometry.CONTENT_WIDTH / (settings ? settings.fontSize : 30)));
  const restTitleHeight = titleLines.length * type.titleHeight;
  const hintTop = restTitleHeight + 12;
  const hintsHeight = hintLines.length * type.hintHeight;
  const text = [details(view), warning].filter(Boolean).join('\n');
  const rawLines = text ? lines(text, Math.floor(geometry.CONTENT_WIDTH / type.hintSize)) : [];
  const detailsTop = restTitleHeight + (hintLines.length ? 12 + hintsHeight : 0) + (text ? 16 : 0);
  // Keep even the longest status/error above the bottom gear. All error rows
  // remain in a scrollable list, including at the largest global font size.
  const detailsHeight = Math.min(84, Math.max(type.hintHeight, geometry.CONTENT_WIDTH - detailsTop), rawLines.length * type.hintHeight);
  const restHeight = detailsTop + detailsHeight;
  return { titleLines, restTitleHeight, hintTop, hintsHeight, hintLines, rawLines, hasDetails: !!text, detailsTop, detailsHeight, restHeight,
    restTop: geometry.centerTop(restHeight) };
}

module.exports = { lines, errorText, details, layout, navigationText, roundaboutExit, navigationLayout, restLayout, typography,
  STATUS_HINTS, waitingStatus, statusHints };
