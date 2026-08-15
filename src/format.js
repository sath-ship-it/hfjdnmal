/* Zahlen und Beträge, überall gleich.

   Steht bewusst in einer eigenen Datei: sowohl App.jsx als auch die
   Ansichten brauchen das. Läge es in App.jsx, würde jede Ansicht, die
   es importiert, einen Ringschluss bauen — und der endet in dieser
   Anwendung als grauer Bildschirm. */

export const zahl = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export const euro = (n) => n == null ? "—"
  : n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/* Stunden mit einer Nachkommastelle — 7,5 liest sich auf dem
   Stundenzettel besser als 7,50 oder 7:30. */
export const std = (n) => n.toLocaleString("de-DE",
  { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " h";
