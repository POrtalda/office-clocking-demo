import { Link } from "react-router-dom";
import DemoBanner from "../DemoBanner/DemoBanner";
import "./FeaturesPage.css";

export default function FeaturesPage() {
  const features = [
    {
      title: "Timbrature entrata/uscita",
      text: "Gli utenti possono registrare entrata e uscita da una web app semplice, utilizzabile anche da smartphone.",
    },
    {
      title: "Riepilogo giornata",
      text: "La Home utente mostra lo stato della giornata e suggerisce l'azione principale da eseguire.",
    },
    {
      title: "Gestione assenze",
      text: "Ferie, PIR e mutua vengono raccolte in modo ordinato, con storico richieste e stati sempre visibili.",
    },
    {
      title: "Dashboard amministratore",
      text: "L'amministratore può controllare utenti, richieste, anomalie e riepiloghi da un'unica schermata.",
    },
    {
      title: "Export CSV",
      text: "I dati possono essere esportati per verifiche interne, paghe o consulente del lavoro.",
    },
    {
      title: "Geolocalizzazione",
      text: "Nella versione reale è possibile limitare la timbratura all'area dell'ufficio.",
    },
  ];

  const highlights = [
    "Demo con utenti già pronti",
    "Interfaccia responsive",
    "Ruoli admin e utente",
    "Dati dimostrativi sicuri",
  ];

  const demoSteps = [
    {
      title: "1. Scegli un profilo demo",
      text: "Accedi come admin o come utente usando i profili già disponibili nella login.",
    },
    {
      title: "2. Prova le azioni principali",
      text: "Timbra, invia richieste assenza, consulta riepiloghi e naviga tra le sezioni principali.",
    },
    {
      title: "3. Valuta il flusso completo",
      text: "Dal lato admin puoi controllare richieste, utenti, ferie approvate ed esportazioni.",
    },
  ];

  return (
    <>
      <DemoBanner />

      <main className="features-page">
        <section className="features-hero">
          <div className="features-badge">Progetto full-stack React + Node.js</div>

          <h1>Office Clocking, una demo reale per la gestione presenze</h1>

          <p>
            Una web app pensata per piccole aziende, studi professionali e team
            che vogliono gestire timbrature, assenze e riepiloghi in modo più
            ordinato rispetto a fogli Excel o comunicazioni sparse.
          </p>

          <div className="features-actions">
            <Link className="features-primary-link" to="/login">
              Prova la demo
            </Link>

            <a className="features-secondary-link" href="#funzionalita">
              Vedi funzionalità
            </a>
          </div>

          <div className="features-hero-points" aria-label="Punti principali">
            {highlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="features-story">
          <div>
            <span>Perché nasce</span>
            <h2>Un progetto nato da un problema concreto</h2>
          </div>

          <p>
            Office Clocking nasce come progetto portfolio, ma simula un caso
            reale: semplificare la gestione delle presenze quotidiane, ridurre
            errori manuali e dare ad amministratore e utenti una piattaforma
            chiara da usare ogni giorno.
          </p>
        </section>

        <section id="funzionalita" className="features-section">
          <div className="features-section-header">
            <span>Funzionalità principali</span>
            <h2>Tutto quello che serve per testare il flusso completo</h2>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <article className="features-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="features-demo-flow">
          <div className="features-section-header">
            <span>Come provarla</span>
            <h2>Una demo guidata, veloce e sicura</h2>
          </div>

          <div className="features-flow-grid">
            {demoSteps.map((step) => (
              <article className="features-flow-card" key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="features-highlight">
          <div>
            <span>Demo pubblica</span>
            <h2>Provala senza modificare dati reali</h2>
            <p>
              La demo usa utenti e dati dimostrativi già pronti. È pensata per
              mostrare il funzionamento del prodotto in pochi minuti e per
              presentare il progetto in modo professionale.
            </p>
          </div>

          <Link className="features-primary-link" to="/login">
            Vai alla login demo
          </Link>
        </section>
      </main>
    </>
  );
}
