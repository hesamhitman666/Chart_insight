const $ = id => document.getElementById(id);
let selectedImage = null;
let chart = null;

$('imageInput').addEventListener('change', e => {
  selectedImage = e.target.files?.[0] || null;
  if (!selectedImage) return;
  $('preview').src = URL.createObjectURL(selectedImage);
  $('previewWrap').classList.remove('hidden');
  $('ocrStatus').textContent = 'تصویر آماده است. برای استخراج متن، دکمه را بزن.';
});
$('clearImage').addEventListener('click', () => {
  selectedImage = null; $('imageInput').value = ''; $('preview').removeAttribute('src');
  $('previewWrap').classList.add('hidden'); $('ocrText').value = '';
  $('ocrStatus').textContent = 'تصویر حذف شد.';
});
$('readImage').addEventListener('click', async () => {
  if (!selectedImage) { $('ocrStatus').textContent = 'اول یک تصویر انتخاب کن.'; return; }
  if (!window.Tesseract) { $('ocrStatus').textContent = 'کتابخانه OCR بارگذاری نشد؛ اتصال اینترنت را بررسی کن یا متن را دستی وارد کن.'; return; }
  $('readImage').disabled = true;
  try {
    $('ocrStatus').textContent = 'در حال خواندن تصویر؛ ممکن است کمی طول بکشد...';
    const result = await Tesseract.recognize(selectedImage, 'eng');
    $('ocrText').value = result.data.text || '';
    $('ocrStatus').textContent = 'تمام شد. اعداد و ستون‌ها را حتماً دستی بررسی کن؛ OCR ممکن است اشتباه کند.';
  } catch(err) { $('ocrStatus').textContent = 'خواندن تصویر ناموفق بود. متن را دستی وارد کن.'; }
  finally { $('readImage').disabled = false; }
});

function parseRows(raw) {
  return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/[,\t;،]+/).map(x => x.trim());
    if (parts.length < 2) return null;
    // Supports: date,close,volume OR close,volume
    let date, close, volume;
    if (parts.length >= 3 && !Number.isFinite(Number(parts[0]))) {
      date = parts[0]; close = Number(parts[1]); volume = Number(parts[2]);
    } else {
      date = `ردیف ${Math.random().toString(36).slice(2,6)}`;
      close = Number(parts[0]); volume = parts.length > 1 ? Number(parts[1]) : NaN;
    }
    if (!Number.isFinite(close) || close <= 0) return null;
    return {date, close, volume: Number.isFinite(volume) ? volume : null};
  }).filter(Boolean);
}
function mean(a){return a.reduce((s,x)=>s+x,0)/a.length}
function calcRSI(values, period=14) {
  if (values.length < period+1) return null;
  const diffs = [];
  for(let i=1;i<values.length;i++) diffs.push(values[i]-values[i-1]);
  const recent = diffs.slice(-period);
  const gains = recent.map(x=>Math.max(x,0)), losses = recent.map(x=>Math.max(-x,0));
  const avgGain=mean(gains), avgLoss=mean(losses);
  if(avgLoss===0) return avgGain===0 ? 50 : 100;
  return 100 - (100/(1+avgGain/avgLoss));
}
function fmt(n){return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:2}):'—'}
$('analyze').addEventListener('click', () => {
  const rows = parseRows($('dataInput').value);
  if(rows.length < 2) { alert('حداقل دو ردیف عددی وارد کن. هر خط: تاریخ,بسته‌شدن,حجم یا بسته‌شدن,حجم'); return; }
  const values=rows.map(r=>r.close), first=values[0], last=values.at(-1);
  const change=(last-first)/first*100;
  const smaPeriod=Math.min(20, values.length);
  const sma=mean(values.slice(-smaPeriod));
  const rsi=calcRSI(values);
  const volumes=rows.map(r=>r.volume).filter(v=>v!==null);
  const lastVol=volumes.length?volumes.at(-1):null;
  const direction=change>1?'مثبت':change< -1?'منفی':'تقریباً خنثی';
  $('results').classList.remove('hidden');
  $('summary').innerHTML = `<strong>جمع‌بندی توصیفی:</strong> قیمت در داده‌های واردشده ${direction} بوده و تغییر کل بازه ${fmt(change)}٪ است. این برچسب به‌تنهایی سیگنال خرید یا فروش نیست.`;
  $('sma').textContent=`SMA ${smaPeriod} ردیف آخر: ${fmt(sma)} — قیمت آخر: ${fmt(last)}؛ ${last>sma?'بالاتر از میانگین':last<sma?'پایین‌تر از میانگین':'برابر با میانگین'}.`;
  $('rsi').textContent=rsi===null?'داده کافی نیست؛ برای RSI(14) حداقل ۱۵ قیمت لازم است.':`${fmt(rsi)} — بالای 70 معمولاً ناحیه اشباع خرید و زیر 30 معمولاً ناحیه اشباع فروش تلقی می‌شود؛ این‌ها تضمین برگشت نیستند.`;
  $('change').textContent=`${fmt(change)}٪ (${fmt(first)} تا ${fmt(last)})`;
  $('volume').textContent=lastVol===null?'حجم وارد نشده است.':`حجم آخرین ردیف: ${fmt(lastVol)}`;
  const caveats = [
    'این تحلیل فقط از داده‌هایی استفاده می‌کند که خودت وارد کرده‌ای؛ خبرها، صورت‌های مالی، نرخ بهره، تورم، جریان سفارش‌ها و داده زنده بررسی نشده‌اند.',
    'SMA و RSI شاخص‌های گذشته‌نگرند و به‌تنهایی برای تصمیم کافی نیستند.',
    'برای تحلیل بنیادی، صورت‌های مالی رسمی و گزارش‌های معتبر همان دارایی را جداگانه بررسی کن.',
    'داده‌ها را از نظر ترتیب تاریخ، واحد قیمت، تعدیل سهام، منطقه زمانی و خطاهای OCR کنترل کن.',
    'هیچ بازدهی یا نتیجه‌ای تضمین نمی‌شود؛ این صفحه سیگنال قطعی یا توصیه مالی شخصی ارائه نمی‌کند.'
  ];
  $('caveats').innerHTML=caveats.map(x=>`<li>${x}</li>`).join('');
  if(chart) chart.destroy();
  chart=new Chart($('priceChart'), {
    type:'line',
    data:{labels:rows.map(r=>r.date),datasets:[{label:'قیمت بسته‌شدن',data:values,tension:.2,pointRadius:2}]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#e8eef8'}}},scales:{x:{ticks:{color:'#aabbd0',maxTicksLimit:8},grid:{color:'#25384e'}},y:{ticks:{color:'#aabbd0'},grid:{color:'#25384e'}}}}
  });
  $('results').scrollIntoView({behavior:'smooth'});
});
$('sample').addEventListener('click',()=>{
  $('dataInput').value=[
    '2026-10-01,100,1200','2026-10-02,102,1350','2026-10-03,101,1100',
    '2026-10-04,104,1500','2026-10-05,103,1450','2026-10-06,105,1600',
    '2026-10-07,107,1700','2026-10-08,106,1550','2026-10-09,108,1800',
    '2026-10-10,109,1900','2026-10-11,108,1750','2026-10-12,111,2100',
    '2026-10-13,110,2000','2026-10-14,112,2300','2026-10-15,114,2400',
    '2026-10-16,113,2200'
  ].join('\n');
});
$('clearData').addEventListener('click',()=>{$('dataInput').value='';$('results').classList.add('hidden');});
