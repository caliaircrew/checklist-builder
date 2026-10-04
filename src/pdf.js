// Cali Aircrew — shared PDF writer (no library). Draws rendered HTML pages (816×1056 px .page elements) as a vector
// PDF using the built-in Helvetica fonts (WinAnsi), Symbol for arrows/≥/≤ and ZapfDingbats for ✓.
// Inserted by build.py into the checklist builder (the PDF_JS placeholder in src/app_template.html) and the crew pages (src/crew.js).
const PDF_WIN={0x20AC:128,0x201A:130,0x0192:131,0x201E:132,0x2026:133,0x2020:134,0x2021:135,0x02C6:136,0x2030:137,0x0160:138,0x2039:139,0x0152:140,0x017D:142,0x2018:145,0x2019:146,0x201C:147,0x201D:148,0x2022:149,0x2013:150,0x2014:151,0x02DC:152,0x2122:153,0x0161:154,0x203A:155,0x0153:156,0x017E:158,0x0178:159};
const PDF_SYM={0x2192:0xAE,0x2190:0xAC,0x2191:0xAD,0x2193:0xAF,0x2194:0xAB,0x21D2:0xDE,0x2265:0xB3,0x2264:0xA3,0x2260:0xB9,0x2248:0xBB,0x221E:0xA5,0x0394:0x44,0x2206:0x44,0x2032:0xA2,0x2033:0xB2};
const PDF_DING={0x2713:0x33,0x2714:0x34,0x2717:0x37,0x2718:0x38,0x2605:0x48,0x2606:0x48,0x25CF:0x6C,0x25A0:0x6E,0x25B2:0x73,0x25BC:0x74};
const pdfFontOf=cp=>PDF_SYM[cp]!==undefined?"S":PDF_DING[cp]!==undefined?"D":"T";
function pdfEnc(str,kind){let o="";for(const ch of str){const cp=ch.codePointAt(0);let b;
  if(kind==="S") b=PDF_SYM[cp]; else if(kind==="D") b=PDF_DING[cp]; else b=cp<128||(cp>=160&&cp<256)?cp:(PDF_WIN[cp]!==undefined?PDF_WIN[cp]:63);
  if(b===40||b===41||b===92) o+="\\"+String.fromCharCode(b); else if(b<32||b>126) o+="\\"+b.toString(8).padStart(3,"0"); else o+=String.fromCharCode(b);}return o}
const pdfRGB=c=>{const m=(c||"").match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/); if(!m) return null; if(m[4]!==undefined&&+m[4]===0) return null; return [m[1],m[2],m[3]].map(v=>(+v/255).toFixed(3)).join(" ")};
function pdfPage(page){
  const pr=page.getBoundingClientRect(), k=0.75, H=792, ops=[];
  const X=v=>((v-pr.left)*k).toFixed(2), Y=v=>(H-(v-pr.top)*k).toFixed(2);
  const fill=(x,y,w,h,col)=>{ if(w<=0||h<=0) return; ops.push(`${col} rg ${X(x)} ${(H-(y+h-pr.top)*k).toFixed(2)} ${(w*k).toFixed(2)} ${(h*k).toFixed(2)} re f`) };
  const text=(s,x,base,st,kind)=>{ const fs=parseFloat(st.fontSize)*k, b=parseInt(st.fontWeight)>=600, it=st.fontStyle!=="normal";
    const f=kind==="S"?"/F5":kind==="D"?"/F6":b&&it?"/F4":b?"/F2":it?"/F3":"/F1";
    ops.push(`BT ${f} ${fs.toFixed(2)} Tf ${pdfRGB(st.color)||"0 0 0"} rg ${X(x)} ${Y(base)} Td (${pdfEnc(s,kind)}) Tj ET`) };
  const els=[page,...page.querySelectorAll("*")];
  els.forEach(el=>{ const st=getComputedStyle(el); if(st.display==="none"||st.visibility==="hidden") return; const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    const bg=pdfRGB(st.backgroundColor); if(bg&&bg!=="1.000 1.000 1.000") fill(r.left,r.top,r.width,r.height,bg);
    const bw=s=>st[`border${s}Style`]!=="none"?parseFloat(st[`border${s}Width`])||0:0, bc=s=>pdfRGB(st[`border${s}Color`]);
    const t=bw("Top"),bo=bw("Bottom"),l=bw("Left"),ri=bw("Right");
    if(t&&bc("Top")) fill(r.left,r.top,r.width,t,bc("Top")); if(bo&&bc("Bottom")) fill(r.left,r.bottom-bo,r.width,bo,bc("Bottom"));
    if(l&&bc("Left")) fill(r.left,r.top,l,r.height,bc("Left")); if(ri&&bc("Right")) fill(r.right-ri,r.top,ri,r.height,bc("Right"));
    if(el.classList.contains("dots")){ // dot leader: the ::after row of dots, clipped to the box
      const fs=parseFloat(st.fontSize), cv=pdfPage.cv||(pdfPage.cv=document.createElement("canvas").getContext("2d")); cv.font=`${st.fontStyle} ${st.fontWeight} ${fs}px Arial, Helvetica, sans-serif`;
      const dw=cv.measureText(".").width||fs*0.278, n=Math.floor(r.width/dw), sib=el.parentElement.querySelector(".txt");
      const base=sib&&sib.getClientRects().length?[...sib.getClientRects()].pop().bottom-fs*0.212:r.bottom-fs*0.212;
      if(n>0) text(".".repeat(n),r.left,base,st,"T"); }
  });
  const tw=document.createTreeWalker(page,NodeFilter.SHOW_TEXT); let nd;
  while((nd=tw.nextNode())){ const s=nd.nodeValue; if(!s.trim()) continue; const pe=nd.parentElement, st=getComputedStyle(pe); if(st.visibility==="hidden") continue;
    const fs=parseFloat(st.fontSize), toks=[], re=/\S+/g; let m;
    while((m=re.exec(s))){ let cur="",kind=null,start=m.index;
      const push=(str,kd,at)=>{ if(!str) return; const rg=document.createRange(); rg.setStart(nd,at); rg.setEnd(nd,at+str.length); const rs=[...rg.getClientRects()].filter(x=>x.width>0); if(!rs.length) return; const rr=rs[0]; toks.push({s:str,k:kd,x:rr.left,r:rs[rs.length-1].right,top:rr.top,bottom:rr.bottom}) };
      let i=m.index; for(const ch of m[0]){ const kd=pdfFontOf(ch.codePointAt(0)); if(kd!==kind){ push(cur,kind,start); cur=""; kind=kd; start=i } cur+=ch; i+=ch.length } push(cur,kind,start) }
    let line=null; const flush=()=>{ if(line) text(line.s,line.x,line.bottom-fs*0.212,st,line.k); line=null };
    toks.forEach(tk=>{ if(line&&tk.k==="T"&&line.k==="T"&&Math.abs(tk.top-line.top)<fs*0.5&&tk.x-line.r<fs*0.45){ line.s+=" "+tk.s; line.r=tk.r } else { flush(); line=tk } });
    flush(); }
  return ops.join("\n");
}
function pdfBuild(pages,title){
  const objs=[], add=s=>{objs.push(s);return objs.length};
  const font=n=>add(`<< /Type /Font /Subtype /Type1 /BaseFont /${n}${/Symbol|Dingbats/.test(n)?"":" /Encoding /WinAnsiEncoding"} >>`);
  add(""); add(""); // 1 catalog, 2 pages
  const F=["Helvetica","Helvetica-Bold","Helvetica-Oblique","Helvetica-BoldOblique","Symbol","ZapfDingbats"].map(font);
  const res=`<< /Font << ${F.map((n,i)=>`/F${i+1} ${n} 0 R`).join(" ")} >> >>`;
  const kids=pages.map(c=>{ const cs=add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`); return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${res} /Contents ${cs} 0 R >>`) });
  objs[0]="<< /Type /Catalog /Pages 2 0 R >>"; objs[1]=`<< /Type /Pages /Kids [${kids.map(k=>k+" 0 R").join(" ")}] /Count ${kids.length} >>`;
  const info=add(`<< /Title (${pdfEnc(title,"T")}) /Producer (Cali Aircrew) >>`);
  let out="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const off=[];
  objs.forEach((o,i)=>{ off.push(out.length); out+=`${i+1} 0 obj\n${o}\nendobj\n` });
  const x=out.length; out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(o=>String(o).padStart(10,"0")+" 00000 n \n").join("");
  out+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  const bytes=new Uint8Array(out.length); for(let i=0;i<out.length;i++) bytes[i]=out.charCodeAt(i)&255; return new Blob([bytes],{type:"application/pdf"});
}
