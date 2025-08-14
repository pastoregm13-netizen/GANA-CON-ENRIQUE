/*! qrmini.js – QR simple (v0.2) */
(function(global){
  const QR={};
  const GALOIS_EXP=new Array(512), GALOIS_LOG=new Array(256);
  (function(){
    let x=1;
    for(let i=0;i<255;i++){GALOIS_EXP[i]=x; GALOIS_LOG[x]=i; x<<=1; if(x&0x100) x^=0x11d;}
    for(let i=255;i<512;i++) GALOIS_EXP[i]=GALOIS_EXP[i-255];
  })();
  function gexp(n){return GALOIS_EXP[n%255<0?(n%255)+255:n%255];}
  function glog(n){if(n===0) throw RangeError(); return GALOIS_LOG[n];}
  function pmul(a,b){ if(a===0||b===0) return 0; return gexp(glog(a)+glog(b)); }

  const ECC_TABLE = {
    1:[19,7,1], 2:[34,10,1], 3:[55,15,1], 4:[80,20,1], 5:[108,26,1],
    6:[136,36,2], 7:[156,40,2], 8:[194,48,2], 9:[232,60,2], 10:[274,72,4],
    11:[324,80,4], 12:[370,96,4], 13:[428,108,4], 14:[461,120,4], 15:[523,132,4]
  };

  function toBytes(str){
    const out=[]; for(let i=0;i<str.length;i++){
      const c=str.charCodeAt(i);
      if(c<0x80) out.push(c);
      else if(c<0x800){ out.push(0xC0|(c>>6),0x80|(c&63)); }
      else if(c<0x10000){ out.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63)); }
      else { out.push(0xF0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63)); }
    } return out;
  }

  function chooseVersion(len){
    for(let v=1; v<=15; v++){
      const meta=ECC_TABLE[v]; if(!meta) break;
      const lenBits = v<=9?8:16;
      const capacityBits = meta[0]*8;
      if((4 + lenBits + len*8) <= capacityBits) return v;
    }
    throw new Error("Cadena demasiado larga");
  }

  function rsGenerator(ecBytes){
    let g=[1];
    for(let i=0;i<ecBytes;i++){
      const next=[]; for(let j=0;j<g.length;j++) next[j]=g[j];
      next.push(0);
      for(let j=0;j<g.length;j++){
        next[j] ^= pmul(g[j], gexp(i));
      }
      g=next;
    }
    return g;
  }

  function rsEncode(data, ecBytes){
    const res = data.concat(new Array(ecBytes).fill(0));
    const gen = rsGenerator(ecBytes);
    for(let i=0;i<data.length;i++){
      const coef = res[i];
      if(coef===0) continue;
      for(let j=0;j<gen.length;j++){
        res[i+j] ^= pmul(coef, gen[j]);
      }
    }
    return res.slice(data.length);
  }

  function bitBuffer(){
    const arr=[]; return {
      arr,
      put(num, len){ for(let i=len-1;i>=0;i--) arr.push((num>>>i)&1); },
      toBytes(){ const out=[]; for(let i=0;i<arr.length;i+=8){ let b=0; for(let j=0;j<8;j++){ b=(b<<1)| (arr[i+j]||0); } out.push(b);} return out; }
    };
  }

  function padBytes(bytes, total){
    bytes.push(0xEC,0x11);
    while(bytes.length<total) bytes.push(0xEC,0x11);
    return bytes.slice(0,total);
  }

  function buildMatrix(version, data){
    const size = 17 + 4*version;
    const m = Array.from({length:size}, ()=>Array(size).fill(null));
    function placeFinder(r,c){
      for(let i=-1;i<=7;i++) for(let j=-1;j<=7;j++){
        const rr=r+i, cc=c+j;
        if(rr<0||rr>=size||cc<0||cc>=size) continue;
        const on = (i>=0&&i<=6&&j>=0&&j<=6) && (
          (i===0||i===6||j===0||j===6) || (i>=2&&i<=4&&j>=2&&j<=4)
        );
        m[rr][cc] = on?1:0;
      }
    }
    placeFinder(0,0); placeFinder(0,size-7); placeFinder(size-7,0);
    for(let i=8;i<size-8;i++){ m[6][i]= (i%2===0)?1:0; m[i][6]=(i%2===0)?1:0; }
    if(version>=2){
      const centers=[6, size-7, Math.floor(size/2)];
      centers.forEach(y=>{
        centers.forEach(x=>{
          if((y===6&&x===6)||(y===6&&x===size-7)||(y===size-7&&x===6)) return;
          if(y<0||y>=size||x<0||x>=size) return;
          for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++){
            const rr=y+i, cc=x+j; if(rr<0||rr>=size||cc<0||cc>=size) continue;
            const on = (Math.max(Math.abs(i),Math.abs(j))!==1);
            m[rr][cc]=on?1:0;
          }
        });
      });
    }
    for(let i=0;i<9;i++){ if(m[8][i]==null) m[8][i]=0; if(m[i][8]==null) m[i][8]=0; }
    for(let i=size-8;i<size;i++){ if(m[8][i]==null) m[8][i]=0; if(m[i][8]==null) m[i][8]=0; }
    const bits = data;
    let row=size-1, col=size-1, dir=-1, bi=0;
    function nextEmpty(r,c){ return m[r][c]==null; }
    while(col>0){
      if(col===6) col--;
      for(let i=0;i<size;i++){
        const r=row + dir*i;
        if(r<0||r>=size) continue;
        for(let j=0;j<2;j++){
          const c=col-j;
          if(nextEmpty(r,c)){ m[r][c] = (bits[bi++]||0); }
        }
      }
      col-=2; dir*=-1;
    }
    for(let r=0;r<size;r++) for(let c=0;c<size;c++){
      if(m[r][c]===0||m[r][c]===1){
        const mask = ((r+c)%2===0); m[r][c] ^= mask?1:0;
      }
    }
    return m;
  }

  function renderToCanvas(matrix, canvas, scale=6, margin=2){
    const size = matrix.length;
    const ctx = canvas.getContext('2d');
    const dim = (size + margin*2)*scale;
    canvas.width=dim; canvas.height=dim;
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,dim,dim);
    ctx.fillStyle='#000';
    for(let r=0;r<size;r++){
      for(let c=0;c<size;c++){
        if(matrix[r][c]) ctx.fillRect((c+margin)*scale,(r+margin)*scale,scale,scale);
      }
    }
  }

  QR.draw = function(text, canvas){
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(text));
    const ver = chooseVersion(bytes.length);
    const meta = ECC_TABLE[ver];
    const capacity = meta[0];
    const bb = bitBuffer();
    bb.put(0b0100,4);
    if(ver<=9){ bb.put(bytes.length,8); } else { bb.put(bytes.length,16); }
    bytes.forEach(b=>bb.put(b,8));
    bb.put(0,4);
    let dataBytes = bb.toBytes();
    if(dataBytes.length>capacity) dataBytes = dataBytes.slice(0,capacity);
    else if(dataBytes.length<capacity) padBytes(dataBytes, capacity);
    const ecBytes = meta[1];
    const ec = rsEncode(dataBytes, ecBytes);
    const finalBytes = dataBytes.concat(ec);
    const bits = [];
    for(const b of finalBytes){ for(let i=7;i>=0;i--) bits.push((b>>i)&1); }
    const matrix = buildMatrix(ver, bits);
    renderToCanvas(matrix, canvas, 6, 2);
  };
  global.QRMini = QR;
})(window);
