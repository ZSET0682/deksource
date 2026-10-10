// 상점·주문서·관리자 페이지가 같이 쓰는 도우미

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'showcase'];
const RARITY_KO = { common: '일반', uncommon: '특별', rare: '희귀', epic: '서사', showcase: '쇼케이스' };

// 서사·쇼케이스와 2,000원 이상 희귀는 수량을 정확히 관리하고(거래 완료 시 차감),
// 나머지는 '있음/없음'만 관리한다 (q > 0 이면 있음, 수량은 판매자가 카톡으로 확인).
// functions/api/_store.js 의 isCountedCard 와 같은 규칙.
const COUNTED_RARE_MIN = 2000;
const isCounted = (card, price) => card.rarity === 'epic' || card.rarity === 'showcase'
  || (card.rarity === 'rare' && price >= COUNTED_RARE_MIN);
const CART_MAX = 99;           // 있음/없음 카드의 장바구니 최대 수량
const UNCOMMON_FOIL_EXTRA = 3000;

// 데이터 서버. github.io 등 다른 주소에서 화면을 띄울 때도 재고·주문은 Cloudflare 쪽 API를 쓴다.
const API = location.hostname.endsWith('.pages.dev') || location.hostname === 'localhost' ? '' : 'https://deksource.pages.dev';

const won = (n) => (n || 0).toLocaleString('ko-KR') + '원';

// 공식 CDN 이미지를 원하는 폭의 webp로
const imgUrl = (card, w) => `${card.img}?w=${w}&fm=webp&accountingTag=RB`;

// 카드 하나 = 판매 품목(sku) 하나. sku는 카드 id 그대로.
function skusOf(card) {
  return [{ sku: card.id }];
}

function skuInfo(sku, cardById) {
  const card = cardById[sku];
  return card ? { sku, card } : null;
}

async function loadCards() {
  const cards = await (await fetch('cards.json')).json();
  const byId = {};
  for (const c of cards) byId[c.id] = c;
  return { cards, byId };
}

// 주문 링크: order.html?id=<주문번호>&o=033-2.045-1
function encodeOrder(lines) {
  return lines.map((l) => `${l.sku}-${l.qty}`).join('.');
}
function newOrderId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
}
function decodeOrder(str) {
  return (str || '').split('.').map((part) => {
    const m = part.match(/^(\d{3}[a-z]?)-(\d{1,3})$/);
    return m ? { sku: m[1], qty: Number(m[2]) } : null;
  }).filter(Boolean);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// 큰 이미지 보기
function openViewer(card) {
  let v = document.getElementById('viewer');
  if (!v) {
    v = document.createElement('div');
    v.id = 'viewer';
    v.addEventListener('click', () => v.classList.remove('show'));
    document.body.appendChild(v);
  }
  v.innerHTML = `<img src="${imgUrl(card, 900)}" alt="${esc(card.name)}" class="${card.landscape ? 'land' : ''}">`;
  v.classList.add('show');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('viewer')?.classList.remove('show');
});

function getAdminKey() {
  try { return localStorage.getItem('adminKey') || ''; } catch { return ''; }
}
function setAdminKey(k) {
  try { k ? localStorage.setItem('adminKey', k) : localStorage.removeItem('adminKey'); } catch {}
}
async function adminFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey(), ...(opts.headers || {}) },
  });
  if (res.status === 401) throw Object.assign(new Error('비밀번호가 틀렸어요'), { status: 401 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || '서버 오류 ' + res.status);
  }
  return res.json();
}
