import { createContext, useContext } from "react";

/* Der Datenzusammenhang liegt bewusst in einem eigenen Modul.

   Vorher stand er in App.jsx, und die Bildschirme holten ihn von dort.
   App.jsx laedt aber seinerseits diese Bildschirme — ein Ring. Beim
   Start hing es davon ab, wer zuerst fertig ausgewertet wurde; mit dem
   dritten Bildschirm kippte es und die App startete gar nicht mehr
   ("Cannot access ... before initialization"), sichtbar als graues Bild.

   Ein eigenes Modul ohne eigene Abhaengigkeiten kann den Ring nicht
   schliessen. */
export const DatenZ = createContext(null);
export const useDaten = () => useContext(DatenZ);
