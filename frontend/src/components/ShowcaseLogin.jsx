import {useEffect,useRef,useState} from "react";
import {SHOWCASE_PROFILES} from "../utils/showcaseLogin";
export default function ShowcaseLogin({baseUrl,onLogin,onPresenter}){
 const [enabled,setEnabled]=useState(false),[message,setMessage]=useState("Verifica accesso rapido…"),[busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{let active=true;void(async()=>{try{
  const response=await fetch(`${baseUrl}/api/demo/showcase/profiles`,{cache:"no-store"});const data=await response.json();
  if(!response.ok||!Array.isArray(data.profiles)||data.profiles.length!==16)throw Error();
  if(active){setEnabled(true);setMessage("Scegli un dipendente: accesso senza password. Sessione di 10 minuti.");}
 }catch{if(active)setMessage("Accesso rapido non attivo. Puoi usare il modulo con credenziali.");}})();return()=>{active=false;};},[baseUrl]);
 async function choose(account){
  if(inFlight.current)return;
  if(account.access==="presenter"){onPresenter(account.profile);setMessage("Admin Demo: inserisci la password privata del presentatore nel modulo.");return;}
  inFlight.current=true;setBusy(true);
  try{const result=await onLogin(account.profile);if(!result?.success)setMessage(result?.message||"Accesso non riuscito. Riprova.");}
  catch{setMessage("Accesso temporaneamente non disponibile.");}finally{inFlight.current=false;setBusy(false);}
 }
 return <section className="login-demo-helper" aria-labelledby="showcase-login-title">
  <div className="login-demo-kicker">Showcase online · dati sintetici</div>
  <h2 id="showcase-login-title">Prova Office Clocking</h2>
  <p role="status" aria-live="polite">{message}</p>
  <div className="login-demo-buttons" aria-busy={busy}>
   {SHOWCASE_PROFILES.map(account=><button key={account.profile} type="button" className={`login-demo-button${account.access==="presenter"?" login-demo-button-featured":""}`} disabled={busy||(account.access==="public"&&!enabled)} onClick={()=>choose(account)}>
    <span className="login-demo-button-icon" aria-hidden="true">{account.access==="presenter"?"👑":"👤"}</span>
    <span className="login-demo-button-text"><strong>{account.label}</strong><small>{account.access==="presenter"?"Presentatore · credenziali richieste":"Accesso con un clic"}</small></span>
   </button>)}
  </div>
  <p>L’accesso pubblico non concede privilegi Admin. Email disabilitate.</p>
 </section>;
}
