# AND-REL-002 — revisione contenuti web

Data verifica: 13 settembre 2026.

## Matrice pubblicata

| Stato | Disponibile | Non disponibile |
| --- | --- | --- |
| Senza account | Indice da D-28 a D-7, meteo e terreno. Nell'app, registrazione temporanea del percorso con salvataggio o condivisione manuale. | Forecast, analisi dell'indice, archivio locale o cloud, upload GPX e tracce salvate sulla mappa. |
| Account active | Indice aggiornato, analisi, archivio cloud, upload GPX, tracce e marker sulla mappa, export e richiesta di cancellazione. | Forecast, finché non sarà effettivamente disponibile. |
| Account restricted | Indice pubblico da D-28 a D-7, meteo, terreno, documenti, export e richiesta di cancellazione. | Indice aggiornato, analisi e archivio GPX. |
| Account deletion_pending | Indice pubblico da D-28 a D-7, meteo, terreno, documenti e stato della richiesta. | Indice aggiornato, analisi, archivio GPX e nuova richiesta di export. |

I gate applicativi restano server-authoritative: i testi non sostituiscono RLS, RPC o policy Storage.

## Verifiche documentali

- I documenti web `terms-of-use.md` e `privacy-policy.md` sono byte per byte identici alle copie approvate in `docs/legal/` del repository applicativo.
- In `account-and-data.md` è stata applicata esclusivamente la sostituzione editoriale approvata relativa ai collegamenti ormai pubblicati.
- Termini e Privacy Policy non sono stati modificati.
- Tutte le pagine pubbliche mantengono link a Termini, Privacy Policy, Account e dati ed Elimina account.

## Stato

AND-REL-002 è completato. L'incongruenza editoriale in **Account e dati** è stata corretta dopo approvazione esplicita, senza modificare Termini, Privacy Policy, versioni legali o comportamento applicativo.

## Correzioni web

- Allineata la finestra guest da D-27…D-7 a D-28…D-7.
- Rimossa dalla pagina Archivio la precedente indicazione che storico e analisi fossero liberamente disponibili senza account.
- Esplicitati requisiti e limiti di guest, active, restricted e deletion_pending nella home, nella pagina Come funziona, nella pagina Archivio, nell'avviso accesso e nel pannello lifecycle.
- Evitata la promessa di forecast nella comunicazione commerciale corrente.
