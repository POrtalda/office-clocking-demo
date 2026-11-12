import {useEffect,useRef,useState} from "react";
import {SHOWCASE_PROFILES} from "../utils/showcaseLogin";
export default function ShowcaseLogin({baseUrl,onLogin}){
 const [adminEnabled,setAdminEnabled]=useState(false);
 const [enabled,setEnabled]=useState(false),[message,setMessage]=useState("Verifica accesso rapido…"),[busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{let active=true;void(async()=>{try{
  const response=await fetch(`${baseUrl}/api/demo/showcase/profiles`,{cache:"no-store"});const data=await response.json();
  if(!response.ok||!Array.isArray(data.profiles)||data.profiles.length!==16)throw Error();
  if(active){setEnabled(true);setAdminEnabled(data.adminQuickLoginEnabled===true);setMessage("Scegli un profilo: accesso senza password. Admin Demo è in sola consultazione. Sessione di 10 minuti.");}
 }catch{if(active)setMessage("Accesso rapido non attivo. Puoi usare il modulo con credenziali.");}})();return()=>{active=false;};},[baseUrl]);
 async function choose(account){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);
  try{const result=await onLogin(account.profile);if(!result?.success)setMessage(result?.message||"Accesso non riuscito. Riprova.");}
  catch{setMessage("Accesso temporaneamente non disponibile.");}finally{inFlight.current=false;setBusy(false);}
 }
 return <section className="login-demo-helper" aria-labelledby="showcase-login-title">
  <div className="login-demo-kicker">Showcase online · dati sintetici</div>
  <h2 id="showcase-login-title">Prova Office Clocking</h2>
  <p role="status" aria-live="polite">{message}</p>
  <div className="login-demo-buttons" aria-busy={busy}>
   {SHOWCASE_PROFILES.map(account=><button key={account.profile} type="button" className={`login-demo-button${account.access==="admin-readonly"?" login-demo-button-featured":""}`} disabled={busy||!enabled||(account.access==="admin-readonly"&&!adminEnabled)} onClick={()=>choose(account)}>
    <span className="login-demo-button-icon" aria-hidden="true">{account.access==="admin-readonly"?"👑":"👤"}</span>
    <span className="login-demo-button-text"><strong>{account.label}</strong><small>{account.access==="admin-readonly"?"Accesso con un clic · sola consultazione":"Accesso con un clic"}</small></span>
   </button>)}
  </div>
  <p>Admin Demo consente solo consultazione ed esportazioni: nessuna modifica ai dati o alla sicurezza. Email disabilitate.</p>
 </section>;
}
