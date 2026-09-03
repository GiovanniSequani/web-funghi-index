# Informativa privacy di FunghiTracker

**Bozza 0.3 - 31 agosto 2026 - non ancora efficace**

Questa informativa spiega come vengono trattati i dati personali nell'app e nel
sito FunghiTracker, destinati inizialmente agli utenti in Italia.

## 1. Titolare del trattamento

Il titolare è **Giovanni Sequani**, contattabile all'indirizzo
**funghitracker@gmail.com**.

FunghiTracker è attualmente un progetto personale gratuito, senza pubblicità,
acquisti, abbonamenti o attività professionale.

## 2. Riservatezza dei luoghi

I percorsi e i ritrovamenti salvati nel tuo account:

- sono privati e non sono visibili agli altri utenti;
- non vengono venduti a terzi o usati per pubblicità;
- non vengono pubblicati come percorsi, punti, mappe o zone di ritrovamenti;
- vengono usati soltanto per fornirti l'archivio e per migliorare l'algoritmo che produce l'indice;
- l'unico risultato pubblico dell'elaborazione dei percorsi e ritrovamenti è l'indice migliorato.

## 3. Quali dati vengono trattati

Quando usi il sito o l'app, i fornitori tecnici ricevono automaticamente
l'indirizzo IP e alcune informazioni sulla richiesta, come data e ora, tipo di
app o browser e risorsa richiesta. Questi dati servono a fornire mappe e
contenuti, prevenire abusi e diagnosticare errori.
FunghiTracker non li usa per pubblicità o profilazione.

### Senza account

Se autorizzi la posizione, l'app la usa per mostrarti sulla mappa e registrare
temporaneamente un percorso. Senza account il percorso resta sul dispositivo
fino alla condivisione, all'abbandono della registrazione o alla cancellazione
dei dati dell'app. FunghiTracker non crea un archivio locale.

### Con un account

Vengono trattati:

- email, username e identificativo dell'account;
- stato dell'account e versioni dei documenti accettati;
- sessioni e informazioni tecniche necessarie al login;
- tipo, data ed esito delle comunicazioni di servizio inviate;
- eventuali comunicazioni con l'assistenza.

La password viene trasmessa direttamente a Supabase Auth e conservata soltanto
come hash crittografico. FunghiTracker non può leggerla in chiaro.

### Percorsi e ritrovamenti

Quando salvi o importi un percorso vengono trattati il file del percorso
(formato `.gpx` compresso), coordinate, altitudine, data, ora, nome, distanza e
modifiche richieste. Per i ritrovamenti vengono trattati posizione, specie e
quantità.

Questi dati sono protetti con particolare attenzione: la posizione dei
ritrovamenti resta privata e non viene condivisa con altri utenti.

## 4. Come vengono migliorati indice e algoritmo

I sistemi interni possono elaborare temporaneamente percorsi e ritrovamenti,
associandoli alle variabili meteorologiche, topografiche e ai valori dell'indice
stimato.
Da ogni percorso vengono ricavate anche statistiche generali sull'attività
registrata, come distanza e tempo trascorso in una zona.

Il contributo di un percorso:

- **non aumenta o diminuisce** il punteggio della zona in cui è stato registrato;
- **non crea una mappa dei luoghi di ritrovamento**;
- **non pubblica le coordinate** dei ritrovamenti;
- **non aggiorna in tempo reale l'indice** in risposta a un singolo ritrovamento.

Serve invece a capire quali combinazioni di condizioni meteorologiche e topografiche
sono associate ai ritrovamenti. Queste relazioni contribuiscono a migliorare
l'algoritmo di previsione dell'indice. L'algoritmo viene poi applicato all'intera
area coperta, tenendo conto delle condizioni di ogni punto.

Le coordinate esatte del percorso sono necessarie nella prima fase, per
collegarlo alle condizioni presenti in quel luogo e momento. Restano
nell'archivio privato finché conservi il percorso e possono essere rielaborate
nella fase iniziale di successivi aggiornamenti. Non vengono però inserite nei
dati finali temporanei usati per calibrare l'algoritmo né nel modello prodotto.

I dati temporanei usati per calibrare l'algoritmo non contengono email,
username, nomi dei percorsi, file originali o identificativi dell'account. Le
informazioni intermedie vengono eliminate entro i termini indicati sotto.

L'accesso umano ai dati puntuali non è ordinario ed è limitato ai casi
necessari per assistenza, sicurezza, problemi tecnici o obblighi di legge.

## 5. Finalità e basi giuridiche

| Perché vengono trattati i dati | Base giuridica |
|---|---|
| Fornire e proteggere le funzioni pubbliche | Legittimo interesse, art. 6(1)(f) GDPR |
| Creare l'account, gestire l'archivio e fornire le funzioni riservate | Esecuzione del contratto, art. 6(1)(b) GDPR |
| Usare percorsi e ritrovamenti per verificare e migliorare l'indice | Esecuzione del contratto contributivo, art. 6(1)(b) GDPR |
| Inviare comunicazioni di servizio e proteggere account e infrastruttura | Esecuzione del contratto e legittimo interesse, artt. 6(1)(b) e 6(1)(f) GDPR |
| Adempiere obblighi di legge | Obbligo legale, art. 6(1)(c) GDPR |

Email, username, maggiore età, accettazione dei Termini e presa visione di
questa informativa sono necessari per creare l'account.

Il permesso del telefono per la posizione è separato e può essere revocato
dalle impostazioni del dispositivo. La revoca disabilita soltanto le funzioni
che richiedono la posizione, come la visualizzazione della propria posizione e
la registrazione del percorso.

## 6. Fornitori e trasferimenti

I dati non vengono comunicati per finalità commerciali. I fornitori tecnici sono:

- **Supabase**, per autenticazione, database e archivio cloud privato; i dati
  principali sono ospitati nella regione EU Central, Francoforte;
- **Cloudflare**, per ospitare e proteggere il sito;
- **Esri**, per immagini satellitari e nomi geografici; riceve dati tecnici e
  l'area della mappa richiesta, ma non i percorsi salvati nell'account;
- **Expo / 650 Industries**, per build e aggiornamenti dell'app;
- **Google e Apple**, per store e sistemi operativi;
- **Google Gmail**, usando l'indirizzo `funghitracker@gmail.com`, per
  assistenza, verifica dell'account, recupero password e altre comunicazioni
  necessarie sullo stato dell'account. Google riceve l'indirizzo del
  destinatario e il contenuto del messaggio; le email non contengono percorsi,
  coordinate o ritrovamenti.

Alcuni fornitori possono trattare dati fuori dallo Spazio economico europeo.
Quando necessario, i trasferimenti avvengono sulla base delle garanzie previste
dal GDPR, come decisioni di adeguatezza o clausole contrattuali standard. I
fornitori e le relative garanzie saranno verificati prima che questa
informativa diventi efficace.

## 7. Conservazione

- **Account, percorsi e ritrovamenti:** fino alla loro eliminazione da parte
  dell'utente, salvo i periodi di inattività indicati sotto.
- **Account inattivi:** sospensione dopo 24 mesi e cancellazione dopo 36 mesi
  complessivi, quindi con 12 mesi di preavviso.
- **Nuovi Termini non accettati:** accesso limitato e cancellazione dopo 365
  giorni a partire dalla prima comunicazione mostrata dopo un accesso, con promemoria.
- **Eliminazione richiesta:** rimozione appena possibile; eventuali residui
  tecnici entro 30 giorni.
- **Dati temporanei usati per migliorare l'algoritmo:** eliminazione al termine
  del lavoro e comunque entro 10 giorni.
- **Percorsi registrati senza account:** fino alla condivisione,
  all'abbandono, alla cancellazione dei dati dell'app o alla disinstallazione.
- **Richieste di assistenza:** normalmente non oltre 24 mesi dalla chiusura.
- **Email di servizio:** copie inviate e dati tecnici dell'invio normalmente
  non oltre 24 mesi; in caso di eliminazione dell'account vengono rimosse
  appena possibile e gli eventuali residui entro 30 giorni.
- **Log tecnici dei fornitori:** secondo i tempi necessari alla sicurezza e al
  funzionamento dei rispettivi servizi.

FunghiTracker non crea copie di backup separate dei percorsi salvati. Non usare
l'archivio cloud come unica copia dei percorsi che vuoi conservare.

## 8. Sicurezza

Le misure previste comprendono comunicazioni cifrate, archivio cloud privato,
regole che limitano ogni utente ai propri dati, download protetti, separazione
delle credenziali amministrative ed eliminazione rapida dei dati temporanei.

Un account sospeso viene escluso dai nuovi processi di miglioramento e mantiene
soltanto le funzioni necessarie a leggere i documenti, riattivarsi, esportare i
dati o eliminare l'account.

## 9. Diritti dell'utente

Nei casi previsti dal GDPR puoi chiedere accesso, rettifica, esportazione,
limitazione, cancellazione e opposizione ai trattamenti basati sul legittimo
interesse.

Puoi usare le funzioni dell'account o scrivere a
**funghitracker@gmail.com**. Potrà essere richiesta una verifica proporzionata
dell'identità; non inviare password, percorsi o coordinate via email. La
risposta viene fornita normalmente entro un mese, salvo i casi previsti dalla
legge.

Puoi inoltre presentare reclamo al
[Garante per la protezione dei dati personali](https://www.garanteprivacy.it/).

## 10. Maggiore età, tecnologie del sito e modifiche

L'account è riservato a persone di almeno 18 anni. Accettando i Termini dichiari
di avere l'età richiesta; non vengono richiesti data di nascita o documento.

Il sito non usa attualmente pubblicità, strumenti di profilazione o analisi del
comportamento. Usa soltanto tecnologie necessarie a sessione, sicurezza e
preferenze; per questo non è previsto un banner di consenso. Se la situazione
cambierà, l'informativa e le scelte disponibili saranno aggiornate prima.

Ogni versione di questa informativa indica numero e data. Le modifiche
importanti vengono comunicate chiaramente e non sono applicate
retroattivamente.

## 11. Contatti

Per domande o richieste sulla privacy:

**Giovanni Sequani**  
**funghitracker@gmail.com**
