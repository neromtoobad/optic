#!/usr/bin/env python3
# Assembles the Optic AI media-kit page with fonts + images inlined as data URIs
# (Artifact CSP blocks external hosts). Writes media-kit/index.html.
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
def b64(p): return base64.b64encode((ROOT.parent / p).read_bytes()).decode()
def font(f): return b64(f"assets/fonts/{f}")
def img(p): return b64(f"media-kit/{p}")
mark_svg = (ROOT / "logo/optic-mark.svg").read_text()

FACE = """
@font-face{{font-family:'Space Grotesk';font-weight:500;font-style:normal;src:url(data:font/woff;base64,{sg5}) format('woff');font-display:swap}}
@font-face{{font-family:'Space Grotesk';font-weight:700;font-style:normal;src:url(data:font/woff;base64,{sg7}) format('woff');font-display:swap}}
@font-face{{font-family:'IBM Plex Mono';font-weight:400;font-style:normal;src:url(data:font/woff;base64,{ip4}) format('woff');font-display:swap}}
@font-face{{font-family:'IBM Plex Mono';font-weight:600;font-style:normal;src:url(data:font/woff;base64,{ip6}) format('woff');font-display:swap}}
""".format(sg5=font("sg-500.woff"), sg7=font("sg-700.woff"), ip4=font("ipm-400.woff"), ip6=font("ipm-600.woff"))

SERVICES = [
    ("read","Cross-venue read","0.5","Any token or narrative read across every venue at once."),
    ("edge","Edge Radar","0.5","Today's markets where price looks soft or rich vs the research."),
    ("daily","Daily Alpha","0.5","Decisive, research-backed picks of the day across three desks."),
    ("stocks","Stocks Desk","0.5","OKX tokenized equity (xStock) + equity research + prediction markets."),
    ("rug","Rug Radar","0.05","A 0-100 token safety score with the concrete red flags."),
    ("smart","Smart Money","0.05","Tokens sharp onchain wallets are accumulating right now."),
    ("timing","Narrative Timing","0.05","Where a token sits in its lifecycle — igniting to cooling."),
]

SWATCHES = [
    ("Ink","#05070d","ground"),("Paper","#e8ebf2","text"),("Amber","#f5a623","the accent"),
    ("Muted","#6d7688","labels"),("Teal","#4be3c3","onchain"),("Orange","#ff8a3d","prediction"),
    ("Yellow","#f5c944","attention"),("Danger","#ff5a5a","risk"),
]

TX = [
    ("Identity #4380 registered","0x459debf31e582ed3f7246a894c3ca369777b858a4a42d2e5601d6937339e7fa0"),
    ("Six services registered","0xa8608ea787fe9e6835f257ffb5bc0a46b4bfa81c48dca0ebccc9985c22c3b820"),
    ("First paid read settled","0xfa7f00f3810369e5246d645d8d5282c14f6620d9a45655f24d8ef93b465da106"),
    ("Paid another agent (buyer side)","0xfd2716c08275c1b1e0735c09314334481d92583de3a20671f971bc7fb18fe3b0"),
]

def svc_card(key,name,price,desc):
    return f'''<figure class="card">
      <img loading="lazy" alt="{name} card sample" src="data:image/jpeg;base64,{img(f'web/{key}.jpg')}"/>
      <figcaption><span class="mono lbl">{name}</span><span class="mono price">{price} USDT</span><span class="cd">{desc}</span></figcaption>
    </figure>'''

def swatch(name,hex_,use):
    dark = hex_.lower() in ("#05070d",)
    return f'''<div class="sw"><div class="chip" style="background:{hex_};{'box-shadow:inset 0 0 0 1px rgba(232,235,242,.14)' if dark else ''}"></div>
      <div class="mono sh">{hex_}</div><div class="sn">{name}</div><div class="su mono">{use}</div></div>'''

def tx_row(label,h):
    return f'''<a class="tx" href="https://web3.okx.com/explorer/x-layer/tx/{h}" target="_blank" rel="noopener">
      <span class="txl">{label}</span><span class="mono txh">{h[:10]}…{h[-8:]}</span></a>'''

cards = "\n".join(svc_card(*s) for s in SERVICES)
swatches = "\n".join(swatch(*s) for s in SWATCHES)
txs = "\n".join(tx_row(*t) for t in TX)

BOILER = ("Optic AI is an Agent Service Provider on OKX.AI that reads onchain markets as one connected "
"economy — memecoins, prediction markets, tokenized stocks, and social attention — and reports where they "
"diverge. Seven pay-per-call services, settled in x402 on X Layer. Data and analysis, not financial advice.")

HTML = f'''<style>
{FACE}
*{{box-sizing:border-box}}
:root{{--ink:#05070d;--surface:#0b0e17;--panel:#0f131e;--paper:#e8ebf2;--soft:#aab2c2;--amber:#f5a623;--muted:#6d7688;--line:rgba(232,235,242,.11)}}
html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:var(--ink);color:var(--soft);font-family:'Space Grotesk',system-ui,sans-serif;font-weight:500;line-height:1.62;font-size:17px;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1080px;margin:0 auto;padding:0 28px}}
.mono{{font-family:'IBM Plex Mono',ui-monospace,monospace}}
a{{color:inherit}}
h1,h2,h3{{color:var(--paper);font-weight:700;letter-spacing:-.02em;text-wrap:balance;margin:0}}
.kick{{font-family:'IBM Plex Mono';font-weight:600;font-size:12.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--muted)}}
.amber{{color:var(--amber)}}

/* hero */
.hero{{position:relative;padding:96px 0 64px;overflow:hidden}}
.hero .glow{{position:absolute;inset:0;background:radial-gradient(60% 90% at 78% 8%,rgba(245,166,35,.10),transparent 60%);pointer-events:none}}
.tick{{position:absolute;width:24px;height:24px;border:2px solid rgba(232,235,242,.32)}}
.frame{{position:relative;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:54px 0}}
.lock{{display:flex;align-items:center;gap:22px;margin-bottom:30px}}
.lock svg{{width:76px;height:76px;flex:none}}
.word{{font-weight:700;font-size:46px;letter-spacing:-.01em;color:var(--paper);line-height:1}}
.hero h1{{font-size:clamp(34px,6vw,62px);line-height:1.04;margin:0 0 22px;max-width:15ch}}
.lead{{font-size:clamp(18px,2.4vw,22px);color:var(--soft);max-width:52ch;margin:0}}
.meta{{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:34px}}
.meta span{{font-family:'IBM Plex Mono';font-size:12.5px;letter-spacing:.14em;color:var(--muted)}}
.meta b{{color:var(--paper);font-weight:600}}

section{{padding:60px 0;border-top:1px solid var(--line)}}
.eyebrow{{display:flex;align-items:center;gap:12px;margin-bottom:26px}}
.eyebrow::before{{content:"";width:8px;height:8px;background:var(--amber)}}
.h2{{font-size:clamp(24px,3.4vw,32px);margin-bottom:14px}}
.say{{max-width:60ch;color:var(--soft)}}

/* services grid */
.grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:26px;margin-top:34px}}
.card{{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:4px;overflow:hidden}}
.card img{{display:block;width:100%;height:auto;border-bottom:1px solid var(--line)}}
.card figcaption{{display:grid;grid-template-columns:1fr auto;gap:4px 14px;padding:16px 18px 18px;align-items:baseline}}
.lbl{{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--paper);font-weight:600}}
.price{{font-size:13px;color:var(--amber);font-weight:600;font-variant-numeric:tabular-nums}}
.cd{{grid-column:1/-1;font-size:14.5px;color:var(--muted);line-height:1.5}}

/* brand tokens */
.tokrow{{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px}}
.assets{{display:flex;flex-direction:column;gap:22px}}
.asset{{display:flex;align-items:center;gap:18px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:20px 22px}}
.asset svg{{width:52px;height:52px;flex:none}}
.asset img{{width:56px;height:56px;flex:none;border-radius:8px}}
.asset .an{{color:var(--paper);font-weight:600;font-size:15px}}
.asset .au{{font-size:13px;color:var(--muted)}}
.swatches{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}}
.sw .chip{{height:52px;border-radius:4px}}
.sh{{font-size:11.5px;color:var(--soft);margin-top:8px;letter-spacing:.04em}}
.sn{{font-size:13px;color:var(--paper);font-weight:600;margin-top:2px}}
.su{{font-size:11px;color:var(--muted)}}
.type{{margin-top:30px;display:grid;gap:18px}}
.spec{{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:22px 24px}}
.spec .big{{font-family:'Space Grotesk';font-weight:700;font-size:40px;color:var(--paper);letter-spacing:-.02em;line-height:1}}
.spec .big.m{{font-family:'IBM Plex Mono';font-weight:600;font-size:26px;letter-spacing:.06em}}
.spec .cap{{font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-top:14px}}

/* copy blocks */
.copy{{display:flex;flex-direction:column;gap:16px;margin-top:28px}}
.cbox{{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:20px 22px}}
.cbox .ct{{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}}
.cbox p{{margin:0;color:var(--soft);font-size:15.5px;max-width:66ch}}
.cbtn{{position:absolute;top:14px;right:14px;font-family:'IBM Plex Mono';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:3px;padding:5px 9px;cursor:pointer}}
.cbtn:hover{{color:var(--paper);border-color:var(--muted)}}
.cbtn:focus-visible{{outline:2px solid var(--amber);outline-offset:2px}}
.tags{{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}}
.tag{{font-family:'IBM Plex Mono';font-size:13px;color:var(--paper);background:var(--surface);border:1px solid var(--line);border-radius:100px;padding:8px 15px}}

/* proof */
.txs{{display:flex;flex-direction:column;gap:0;margin-top:26px;border:1px solid var(--line);border-radius:4px;overflow:hidden}}
.tx{{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:15px 20px;text-decoration:none;border-top:1px solid var(--line)}}
.tx:first-child{{border-top:none}}
.tx:hover{{background:var(--surface)}}
.txl{{color:var(--paper);font-size:14.5px}}
.txh{{color:var(--amber);font-size:12.5px;letter-spacing:.02em}}
.dl{{display:inline-flex;align-items:center;gap:10px;margin-top:28px;font-family:'IBM Plex Mono';font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--amber);border-radius:4px;padding:13px 20px;text-decoration:none;font-weight:600}}
.dl:hover{{filter:brightness(1.06)}}

footer{{border-top:1px solid var(--line);padding:40px 0 60px;color:var(--muted);font-family:'IBM Plex Mono';font-size:12.5px;letter-spacing:.06em;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}}
a:focus-visible{{outline:2px solid var(--amber);outline-offset:3px;border-radius:2px}}
@media (max-width:760px){{.grid,.tokrow,.swatches{{grid-template-columns:1fr}}.swatches{{grid-template-columns:repeat(2,1fr)}}.hero{{padding-top:64px}}.lock svg{{width:60px;height:60px}}.word{{font-size:38px}}}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important;animation:none!important}}}}
</style>

<div class="hero">
  <div class="glow"></div>
  <div class="wrap frame">
    <div class="tick" style="top:0;left:-1px;border-width:2px 0 0 2px"></div>
    <div class="tick" style="top:0;right:-1px;border-width:2px 2px 0 0"></div>
    <div class="tick" style="bottom:0;left:-1px;border-width:0 0 2px 2px"></div>
    <div class="tick" style="bottom:0;right:-1px;border-width:0 2px 2px 0"></div>
    <div class="kick" style="margin-bottom:26px">OKX.AI · Agent #4380 · Media Kit</div>
    <div class="lock">{mark_svg}<div class="word">OPTIC A<span class="amber">I</span></div></div>
    <h1>The onchain alpha desk.</h1>
    <p class="lead">Single-domain agents tell you what one market thinks. Optic AI tells you what the whole onchain economy believes — and shows you the picture.</p>
    <div class="meta"><span>SETTLES <b>x402 · X Layer</b></span><span>SERVICES <b>7</b></span><span>OUTPUT <b>JSON verdict + card</b></span><span>STANCE <b>data, not advice</b></span></div>
  </div>
</div>

<section><div class="wrap">
  <div class="eyebrow"><span class="kick">What it is</span></div>
  <div class="h2 h2x">One engine, five lenses, seven services.</div>
  <p class="say">Onchain alpha lives in a dozen tabs that don't talk to each other. Optic reads memecoins (OKX Trenches), prediction markets (Polymarket), tokenized US stocks (OKX xStocks), and social attention (OKX Social) as one connected economy, does the web research behind the numbers, and reports where the venues diverge — because disagreement between markets pricing the same story is the signal.</p>
</div></section>

<section><div class="wrap">
  <div class="eyebrow"><span class="kick">The card is the ad</span></div>
  <div class="h2">Seven services. Every read ships a card.</div>
  <p class="say">Each paid read returns a JSON verdict and a shareable 1200×675 card carrying the OPTIC AI mark. Live samples:</p>
  <div class="grid">
  {cards}
  </div>
</div></section>

<section><div class="wrap">
  <div class="eyebrow"><span class="kick">Identity</span></div>
  <div class="h2">Brand</div>
  <div class="tokrow">
    <div class="assets">
      <div class="asset">{mark_svg}<div><div class="an">Primary mark</div><div class="au">The divergence lens — two venues from one origin</div></div></div>
      <div class="asset"><img alt="Optic AI avatar" src="data:image/jpeg;base64,{img('web/avatar.jpg')}"/><div><div class="an">Avatar / app icon</div><div class="au">512×512, dark, corner-tick framed</div></div></div>
    </div>
    <div>
      <div class="swatches">{swatches}</div>
    </div>
  </div>
  <div class="type">
    <div class="spec"><div class="big">Space Grotesk</div><div class="cap">Display · wordmark · titles</div></div>
    <div class="spec"><div class="big m">IBM Plex Mono</div><div class="cap">Labels · kickers · stats · the okx.ai mark</div></div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="eyebrow"><span class="kick">Copy</span></div>
  <div class="h2">Words</div>
  <div class="tags"><span class="tag">The onchain alpha desk.</span><span class="tag">Where the venues disagree is the signal.</span><span class="tag">Memecoins, predictions, stocks, attention — one read.</span></div>
  <div class="copy">
    <div class="cbox"><div class="ct">Boilerplate</div><p id="boiler">{BOILER}</p><button class="cbtn" data-copy="boiler">Copy</button></div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="eyebrow"><span class="kick">Proof</span></div>
  <div class="h2">Real, on-chain, both directions.</div>
  <p class="say">Optic AI works both sides of the OKX Agent Payments Protocol — buyers pay it, and it pays other agents. Every milestone has a verifiable transaction on X Layer.</p>
  <div class="txs">{txs}</div>
  <a class="dl" href="https://optic-production-5675.up.railway.app/v1/health" target="_blank" rel="noopener">Live endpoint ↗</a>
</div></section>

<footer><div class="wrap" style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:12px"><span>OPTIC AI · OKX.AI AGENT #4380</span><span>DATA & ANALYSIS · NOT FINANCIAL ADVICE</span></div></footer>

<script>
document.querySelectorAll('.cbtn').forEach(function(b){{
  b.addEventListener('click',function(){{
    var el=document.getElementById(b.dataset.copy);
    navigator.clipboard.writeText(el.innerText).then(function(){{var o=b.textContent;b.textContent='Copied';setTimeout(function(){{b.textContent=o}},1400)}});
  }});
}});
</script>'''

(ROOT / "index.html").write_text(HTML)
print("wrote media-kit/index.html", len(HTML), "bytes")
