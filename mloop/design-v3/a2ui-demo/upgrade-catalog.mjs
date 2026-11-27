import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('./schemas/catalog.json', import.meta.url);
const catalog = JSON.parse(readFileSync(path));
const ref = name => ({ $ref: `common_types.json#/$defs/${name}` });
const string = ref('DynamicString'), number = ref('DynamicNumber');
const enumOf = values => ({ type: 'string', enum: values });
const tone = enumOf(['neutral', 'accent', 'success', 'warning', 'danger']);
const array = item => ({ type: 'array', items: item, maxItems: 100 });
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const boundArray = item => ({ oneOf: [array(item), ref('DataBinding')] });
const def = (name, properties, required, description) => ({ type:'object', description, properties: { component: { const:name }, ...properties, weight: { $ref:'#/$defs/Weight' } }, required:['component', ...required] });
const additions = {
  Heading: def('Heading', { text:string, subtitle:string, eyebrow:string, level:enumOf(['1','2','3']) }, ['text'], '页面或区块标题。level 1 为页面标题，level 2/3 为区块标题。'),
  Grid: def('Grid', { children:ref('ChildList'), columns:{type:'integer',minimum:1,maximum:4}, gap:enumOf(['sm','md','lg']) }, ['children'], '响应式网格。指标用 3/4 列，商品、左右内容用 2/3 列，窄屏自动折叠。'),
  Section: def('Section', { title:string, description:string, children:ref('ChildList') }, ['title','children'], '带标题的分组；不用为每个段落再套 Card。'),
  Badge: def('Badge', { label:string, tone }, ['label'], '紧凑的状态、类别或标签。'),
  Stat: def('Stat', { label:string, value:string, change:string, caption:string, trend:enumOf(['up','down','flat']), sparkline:boundArray({type:'number'}) }, ['label','value'], '指标卡，value 为短数字字符串，例如 ¥128,400。change 为环比，sparkline 为趋势数组。'),
  Chart: def('Chart', { title:string, description:string, chartType:enumOf(['line','bar','area','donut']), data:boundArray({type:'object',additionalProperties:{type:['string','number']}}), xKey:{type:'string'}, series:array(object({key:{type:'string'},label:{type:'string'}},['key','label'])), valuePrefix:{type:'string'}, valueSuffix:{type:'string'} }, ['chartType','data','xKey','series'], 'SVG 图表，数据为行对象，series 的 key 是数字字段；折线/面积图至少 3 点，donut 只用一条 series。'),
  DataTable: def('DataTable', { title:string, description:string, columns:array(object({key:{type:'string'},label:{type:'string'},format:enumOf(['text','number','currency','badge']),align:enumOf(['start','end'])},['key','label'])), rows:boundArray({type:'object',additionalProperties:{type:['string','number','boolean','null']}}), searchable:{type:'boolean'} }, ['columns','rows'], '可本地排序、可选搜索的数据表。format=badge 为状态列。'),
  KeyValueList: def('KeyValueList', { title:string, items:boundArray(object({label:string,value:string},['label','value'])) }, ['items'], '信息摘要、订单汇总或键值详情，标签在左值在右。'),
  Callout: def('Callout', { title:string, text:string, tone }, ['text'], '提示或提交结果。tone success/ warning/ danger/ accent/ neutral。'),
  Progress: def('Progress', { label:string, value:number, caption:string, tone }, ['label','value'], '0–100 的进度条，显示百分比。'),
  Avatar: def('Avatar', { name:string, subtitle:string }, ['name'], '带缩写头像的人员介绍。'),
  ProductCard: def('ProductCard', { name:string, category:string, description:string, price:string, compareAt:string, badge:string, rating:number, features:boundArray(string), illustration:enumOf(['headphones','coffee','speaker','bag','plant','abstract']), image:string, actionLabel:string, action:ref('Action') }, ['name','price'], '预先设计好的商品卡片。可用本地图形 illustration，无需虚构图片网址。action 必须为 event。'),
  EventCard: def('EventCard', { title:string, category:string, description:string, date:string, time:string, location:string, attendees:string, actionLabel:string, action:ref('Action') }, ['title','date'], '活动信息卡，包含日期、时间、地点、人数及可选按钮。'),
  Timeline: def('Timeline', { title:string, items:boundArray(object({title:string,description:string,time:string,status:enumOf(['done','current','upcoming'])},['title'])) }, ['items'], '日程、任务进展或时间线。'),
  EmptyState: def('EmptyState', { title:string, description:string }, ['title'], '列表无数据时的友好空态。'),
};
Object.assign(catalog.components, additions);
for (const name of ['Column','Row','List','Card']) catalog.components[name].properties.gap = enumOf(['sm','md','lg']);
catalog.title = 'A2UI Studio Design Catalog';
catalog.description = 'A2UI 1.0 基础交互组件与 Studio 语义组件。视觉由本地渲染器统一控制。';
catalog.instructions = '用 Heading 建立层级，Grid 组织指标和卡片。图表用 Chart，数据用 DataTable，商品用 ProductCard，活动用 EventCard。优先 8–24 个有语义的组件，不重复展示数据。不添加 HTML/CSS/style。';
catalog.$defs.anyComponent = { oneOf:Object.keys(catalog.components).map(k=>({$ref:`#/components/${k}`})) };
writeFileSync(path, JSON.stringify(catalog,null,2)+'\n');
console.log(`Catalog: ${Object.keys(catalog.components).length} components`);
