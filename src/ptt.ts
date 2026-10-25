type RecordingState = {phase:string};
type Options<S extends RecordingState> = {
  start:()=>Promise<S>;
  stop:()=>Promise<S>;
  onState:(state:S)=>void;
  onTap:()=>void;
  onError:(error:unknown)=>void;
  schedule?:(fn:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
  cancel?:(id:ReturnType<typeof setTimeout>)=>void;
};

/** A released button must stop recording even while the start RPC is in flight. */
export function createPushToTalk<S extends RecordingState>(options:Options<S>){
  let held=false,disposed=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let starting:Promise<S|undefined>|undefined;
  const schedule=options.schedule??setTimeout;
  const cancel=options.cancel??clearTimeout;
  return {
    press(){
      if(held||disposed)return;
      held=true;
      timer=schedule(()=>{
        starting=options.start().then(state=>{if(!disposed)options.onState(state);return state;},error=>{if(!disposed)options.onError(error);return undefined;});
      },300);
    },
    release(){
      if(!held||disposed)return;
      held=false;if(timer!==undefined)cancel(timer);timer=undefined;
      if(!starting){options.onTap();return;}
      const pending=starting;starting=undefined;
      void pending.then(state=>!disposed&&state?.phase==='recording'?options.stop():undefined)
        .then(state=>{if(state&&!disposed)options.onState(state);})
        .catch(error=>{if(!disposed)options.onError(error);});
    },
    dispose(){disposed=true;held=false;if(timer!==undefined)cancel(timer);},
  };
}
