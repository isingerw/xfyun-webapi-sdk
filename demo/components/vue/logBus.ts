type LogPayload = { level?: 'info'|'warn'|'error'; panel?: string; event?: string; message?: string; [k: string]: any }

const CHANNEL = '__XFYUN_LOG__'

export function publishLog(payload: LogPayload){
  try{
    const detail = { ts: Date.now(), ...payload }
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail }))
  }catch(e){ /* ignore */ }
}

export function subscribeLog(handler: (payload: any) => void){
  const listener = (e: Event) => { try{ handler((e as CustomEvent).detail) }catch(_){} }
  window.addEventListener(CHANNEL, listener)
  return () => window.removeEventListener(CHANNEL, listener)
}


