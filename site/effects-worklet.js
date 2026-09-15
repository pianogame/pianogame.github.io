/* Streaming phase vocoder: 2048-sample frames, 4x overlap, stereo channels. */
class PitchVocoder {
  constructor() {
    this.size=2048;this.hop=512;this.latency=this.size-this.hop;this.rover=this.latency;
    this.window=Float64Array.from({length:this.size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/this.size));
    this.channels=Array.from({length:2},()=>({fifo:new Float64Array(this.size),out:new Float64Array(this.hop),acc:new Float64Array(this.size),re:new Float64Array(this.size),im:new Float64Array(this.size),previous:new Float64Array(this.size/2+1),phase:new Float64Array(this.size/2+1),magnitude:new Float64Array(this.size/2+1),frequency:new Float64Array(this.size/2+1)}));
  }
  fft(re,im,inverse) {
    const n=this.size;
    for(let i=1,j=0;i<n;i++) {
      let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
      if(i<j){const a=re[i],b=im[i];re[i]=re[j];im[i]=im[j];re[j]=a;im[j]=b;}
    }
    for(let length=2;length<=n;length<<=1) {
      const angle=(inverse?2:-2)*Math.PI/length,wr0=Math.cos(angle),wi0=Math.sin(angle);
      for(let i=0;i<n;i+=length) {
        let wr=1,wi=0;
        for(let j=0;j<length/2;j++) {
          const a=i+j,b=a+length/2,tr=wr*re[b]-wi*im[b],ti=wr*im[b]+wi*re[b];
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          const next=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=next;
        }
      }
    }
    if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
  }
  frame(c,ratio) {
    const n=this.size,half=n/2,expected=2*Math.PI*this.hop/n;
    for(let i=0;i<n;i++){c.re[i]=c.fifo[i]*this.window[i];c.im[i]=0;}
    this.fft(c.re,c.im,false);c.magnitude.fill(0);c.frequency.fill(0);
    for(let k=0;k<=half;k++) {
      const phase=Math.atan2(c.im[k],c.re[k]),magnitude=Math.hypot(c.re[k],c.im[k]);
      let delta=phase-c.previous[k]-k*expected;c.previous[k]=phase;
      delta-=2*Math.PI*Math.round(delta/(2*Math.PI));
      const bin=(k+delta/expected)*ratio,destination=Math.round(k*ratio);
      if(destination<=half){c.magnitude[destination]+=magnitude;c.frequency[destination]+=bin*magnitude;}
    }
    c.re.fill(0);c.im.fill(0);
    for(let k=0;k<=half;k++) {
      const bin=c.magnitude[k]>1e-12?c.frequency[k]/c.magnitude[k]:k;
      c.phase[k]=(c.phase[k]+expected*bin)%(2*Math.PI);
      c.re[k]=c.magnitude[k]*Math.cos(c.phase[k]);c.im[k]=c.magnitude[k]*Math.sin(c.phase[k]);
      if(k>0&&k<half){c.re[n-k]=c.re[k];c.im[n-k]=-c.im[k];}
    }
    c.im[0]=0;c.im[half]=0;this.fft(c.re,c.im,true);
    for(let i=0;i<n;i++)c.acc[i]+=c.re[i]*this.window[i]*(2/3);
    for(let i=0;i<this.hop;i++)c.out[i]=c.acc[i];
    c.acc.copyWithin(0,this.hop);c.acc.fill(0,n-this.hop);c.fifo.copyWithin(0,this.hop);
  }
  process(input,output,ratio) {
    for(let i=0;i<output[0].length;i++) {
      for(let ch=0;ch<2;ch++) {
        const c=this.channels[ch];c.fifo[this.rover]=input?.[ch]?.[i]??input?.[0]?.[i]??0;
        if(output[ch])output[ch][i]=c.out[this.rover-this.latency];
      }
      this.rover++;
      if(this.rover>=this.size){this.rover=this.latency;for(const c of this.channels)this.frame(c,ratio);}
    }
  }
}

/* Audio-thread processors. Stereo-linked envelopes and preallocated delay rings. */
class PianoPaletteDSP extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.p = options.processorOptions || {};
    this.alive = true;
    this.pitch = this.p.type==='pitch'?new PitchVocoder():null;
    this.env = 0; this.gate = 0;
    this.swell = 0; this.holdCounter = 0; this.held = [0,0]; this.svf = [[0,0],[0,0]];
    this.port.onmessage = e => {
      if(e.data.dispose) this.alive = false;
      else Object.assign(this.p,e.data);
    };
  }
  process(inputs,outputs) {
    if(!this.alive) return false;
    const input=inputs[0],output=outputs[0],p=this.p;
    if(!output?.length) return true;
    const n=output[0].length, type=p.type;
    const ratio=Math.pow(2,(p.semitones??12)/12);
    if(type==='pitch') {
      if(Math.abs(ratio-1)<.00001) {for(let c=0;c<output.length;c++)for(let i=0;i<n;i++)output[c][i]=input?.[c]?.[i]??input?.[0]?.[i]??0;}
      else this.pitch.process(input,output,ratio);
      return true;
    }
    const attack=Math.exp(-1/(sampleRate*.003)), release=Math.exp(-1/(sampleRate*.09));
    const threshold=Math.pow(10,(p.threshold??-48)/20);
    const steps=Math.pow(2,(p.bits??8)-1), hold=Math.max(1,Math.round(p.hold??4));
    for(let i=0;i<n;i++) {
      const left=input?.[0]?.[i]||0,right=input?.[1]?.[i]??left;
      const peak=Math.max(Math.abs(left),Math.abs(right));
      this.env=peak+(this.env-peak)*(peak>this.env?attack:release);
      if(type==='gate') {
        const target=this.env>threshold?1:this.env<threshold*.65?0:this.gate;
        const coefficient=target>this.gate?1-Math.exp(-1/(sampleRate*.004)):1-Math.exp(-1/(sampleRate*.065));
        this.gate+=(target-this.gate)*coefficient;
        for(let c=0;c<output.length;c++) output[c][i]=(c?right:left)*this.gate;
      } else if(type==='crusher') {
        if(this.holdCounter--<=0) {
          this.held[0]=Math.round(left*steps)/steps; this.held[1]=Math.round(right*steps)/steps; this.holdCounter=hold-1;
        }
        for(let c=0;c<output.length;c++) output[c][i]=this.held[c%2];
      } else if(type==='swell') {
        const target=this.env>.0025?1:0;
        const time=target?(p.attack??.45):.04;
        this.swell+=(target-this.swell)*(1-Math.exp(-1/(sampleRate*time)));
        for(let c=0;c<output.length;c++) output[c][i]=(c?right:left)*this.swell;
      } else if(type==='autowah') {
        const sweep=Math.min(1,this.env*(p.sensitivity??6));
        const frequency=280+Math.pow(sweep,.65)*(p.depth??2000);
        const g=Math.tan(Math.PI*Math.min(frequency,sampleRate*.2)/sampleRate),k=.65;
        const a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;
        for(let c=0;c<output.length;c++) {
          const state=this.svf[c%2],x=c?right:left,v3=x-state[1];
          const v1=a1*state[0]+a2*v3,v2=state[1]+a2*state[0]+a3*v3;
          state[0]=2*v1-state[0];state[1]=2*v2-state[1];
          output[c][i]=v1*.85+x*.3;
        }
      } else {
        for(let c=0;c<output.length;c++) output[c][i]=c?right:left;
      }
    }
    return true;
  }
}
registerProcessor('piano-palette-dsp',PianoPaletteDSP);
